// useAnalysis hook + mock API + history persistence
const { useState, useEffect, useRef, useCallback } = React;

const HISTORY_KEY = "sa.history.v1";
const COLD_KEY = "sa.warmed";

// ---- Mock analyzer (deterministic-ish based on text) ----
const POSITIVE_WORDS = ["love", "great", "amazing", "fantastic", "wonderful", "excellent", "best", "happy", "delighted", "joy", "thrilled", "perfect", "good", "awesome", "brilliant"];
const NEGATIVE_WORDS = ["hate", "terrible", "awful", "worst", "bad", "horrible", "broken", "disappointed", "angry", "useless", "frustrated", "failed", "annoying", "poor", "ruined"];
const STOPWORDS = new Set("a an and the of to is it i you we they on in for with that this be was were are have has had not but or so very just really my your".split(" "));

function mockAnalyze(text) {
  const lc = text.toLowerCase();
  const words = lc.match(/[a-z']+/g) || [];

  let pos = 0, neg = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.includes(w)) pos++;
    if (NEGATIVE_WORDS.includes(w)) neg++;
  }
  // Punctuation amplifiers
  const exclam = (text.match(/!/g) || []).length;
  pos += exclam * 0.3;

  let sentiment, confidence;
  if (pos > neg) {
    sentiment = "Positive";
    confidence = Math.min(0.95, 0.55 + (pos - neg) * 0.08);
  } else if (neg > pos) {
    sentiment = "Negative";
    confidence = Math.min(0.95, 0.55 + (neg - pos) * 0.08);
  } else {
    sentiment = "Neutral";
    confidence = 0.6 + Math.random() * 0.15;
  }

  // Emotions — weighted by sentiment + a stable hash for variety
  const seed = Array.from(text).reduce((a, c) => (a + c.charCodeAt(0)) % 9973, 0);
  const r = (n) => ((seed * (n + 1) * 7919) % 1000) / 1000;

  let emotions;
  if (sentiment === "Positive") {
    emotions = [
      { label: "Joy", score: 0.55 + r(1) * 0.3 },
      { label: "Surprise", score: 0.20 + r(2) * 0.25 },
      { label: "Sadness", score: 0.05 + r(3) * 0.10 },
      { label: "Anger", score: 0.03 + r(4) * 0.05 },
      { label: "Fear", score: 0.05 + r(5) * 0.08 },
      { label: "Disgust", score: 0.02 + r(6) * 0.05 },
    ];
  } else if (sentiment === "Negative") {
    emotions = [
      { label: "Anger", score: 0.40 + r(1) * 0.30 },
      { label: "Sadness", score: 0.30 + r(2) * 0.25 },
      { label: "Disgust", score: 0.15 + r(3) * 0.20 },
      { label: "Fear", score: 0.10 + r(4) * 0.15 },
      { label: "Surprise", score: 0.08 + r(5) * 0.10 },
      { label: "Joy", score: 0.02 + r(6) * 0.05 },
    ];
  } else {
    emotions = [
      { label: "Surprise", score: 0.25 + r(1) * 0.15 },
      { label: "Joy", score: 0.20 + r(2) * 0.10 },
      { label: "Sadness", score: 0.18 + r(3) * 0.10 },
      { label: "Fear", score: 0.15 + r(4) * 0.10 },
      { label: "Anger", score: 0.12 + r(5) * 0.10 },
      { label: "Disgust", score: 0.10 + r(6) * 0.08 },
    ];
  }
  emotions.sort((a, b) => b.score - a.score);

  // Keywords — simple frequency on non-stopwords, weighted by length
  const freq = {};
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 4) continue;
    freq[w] = (freq[w] || 0) + 1;
  }
  let keywords = Object.entries(freq)
    .map(([term, count]) => ({ term, score: count * (1 + term.length / 12) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
  if (keywords.length) {
    const max = keywords[0].score;
    keywords = keywords.map(k => ({ ...k, score: k.score / max }));
  }

  return { sentiment, confidence, emotions, keywords };
}

// ---- Cold-start simulation ----
// Randomly chosen on first request of session; settings allow overriding.
function fakeRequestDelay(forceCold) {
  if (forceCold === "cold") return 7000 + Math.random() * 2000;
  if (forceCold === "warm") return 600 + Math.random() * 500;
  if (forceCold === "slow") return 12000;
  // Default: cold first time per tab, warm thereafter
  const warmed = sessionStorage.getItem(COLD_KEY);
  if (!warmed) {
    sessionStorage.setItem(COLD_KEY, "1");
    return 4500 + Math.random() * 2000;
  }
  return 700 + Math.random() * 600;
}

// ---- History ----
function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveHistory(list) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); } catch {}
}

// ---- The hook ----
function useAnalysis() {
  // states: idle | loading | success | error | viewing-saved
  const [status, setStatus] = useState("idle");
  const [elapsed, setElapsed] = useState(0);  // ms since loading started
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [lastInput, setLastInput] = useState("");
  const [history, setHistoryState] = useState(() => loadHistory());
  const [highlightId, setHighlightId] = useState(null);
  const [savedFromTime, setSavedFromTime] = useState(null);

  const cancelRef = useRef(null);
  const tickRef = useRef(null);

  useEffect(() => { saveHistory(history); }, [history]);

  // Tick elapsed during loading
  useEffect(() => {
    if (status !== "loading") {
      if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
      setElapsed(0);
      return;
    }
    const start = Date.now();
    setElapsed(0);
    tickRef.current = setInterval(() => setElapsed(Date.now() - start), 100);
    return () => clearInterval(tickRef.current);
  }, [status]);

  const runAnalysis = useCallback((text, errorMode, latencyMode) => {
    setLastInput(text);
    setSavedFromTime(null);
    setStatus("loading");
    setError(null);

    let cancelled = false;
    cancelRef.current = () => { cancelled = true; };

    const delay = fakeRequestDelay(latencyMode);

    setTimeout(() => {
      if (cancelled) return;

      // Simulated errors
      if (errorMode === "network") {
        setError({ kind: "network" });
        setStatus("error");
        return;
      }
      if (errorMode === "timeout") {
        setError({ kind: "timeout" });
        setStatus("error");
        return;
      }
      if (errorMode === "4xx") {
        setError({ kind: "4xx", detail: "Input must contain at least one alphabetic character." });
        setStatus("error");
        return;
      }
      if (errorMode === "5xx") {
        setError({ kind: "5xx" });
        setStatus("error");
        return;
      }

      const r = mockAnalyze(text);
      const entry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ts: Date.now(),
        input: text,
        result: r,
      };
      setResult(r);
      setStatus("success");
      setHistoryState(prev => [entry, ...prev].slice(0, 50));
      setHighlightId(entry.id);
      setTimeout(() => setHighlightId(null), 250);
    }, delay);
  }, []);

  const retry = useCallback((errorMode, latencyMode) => {
    if (lastInput) runAnalysis(lastInput, errorMode, latencyMode);
  }, [lastInput, runAnalysis]);

  const selectHistory = useCallback((id) => {
    const item = history.find(h => h.id === id);
    if (!item) return;
    setResult(item.result);
    setLastInput(item.input);
    setStatus("success");
    setSavedFromTime(item.ts);
    setHighlightId(id);
  }, [history]);

  const clearHistory = useCallback(() => {
    setHistoryState([]);
    setHighlightId(null);
  }, []);

  const reset = useCallback(() => {
    if (cancelRef.current) cancelRef.current();
    setStatus("idle");
    setResult(null);
    setError(null);
    setSavedFromTime(null);
  }, []);

  return {
    status, elapsed, result, error, lastInput,
    history, highlightId, savedFromTime,
    runAnalysis, retry, selectHistory, clearHistory, reset,
    setLastInput,
  };
}

// expose
Object.assign(window, { useAnalysis, mockAnalyze });
