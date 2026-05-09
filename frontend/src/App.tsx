import { useCallback, useEffect, useRef, useState } from "react";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useHistory } from "@/hooks/useHistory";
import { TextInput } from "@/components/TextInput/TextInput";
import { ResultsPanel } from "@/components/ResultsPanel/ResultsPanel";
import { HistoryList } from "@/components/HistoryList/HistoryList";
import { MAX_TEXT_LENGTH } from "@/api/types";

export function App() {
  const analysis = useAnalysis();
  const history = useHistory();
  const { add: addHistory, clear: clearHistory, select: selectHistory } = history;
  const { run: runAnalysis, reset: resetAnalysis, showSaved, retry: retryAnalysis } = analysis;
  const [text, setText] = useState("");
  const [lastRunInput, setLastRunInput] = useState("");
  // Tracks the history row the user is currently viewing (clicked from
  // HistoryList). Distinct from `highlightId` (the brief flash on a fresh
  // entry) so the row selection can persist beyond the 250ms flash.
  const [savedHistoryId, setSavedHistoryId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const highlightTimer = useRef<number | null>(null);

  // Persist each fresh successful analysis to history. `savedAt === undefined`
  // distinguishes a real result from one re-rendered via `showSaved` (which
  // carries the entry's timestamp). Depend on the stable `addHistory` callback,
  // not the whole `history` object — `useHistory` returns a fresh object every
  // render, which would re-fire this effect and re-add the same entry.
  useEffect(() => {
    if (
      analysis.state.status !== "success" ||
      analysis.state.savedAt !== undefined ||
      !lastRunInput
    ) {
      return;
    }
    const entry = addHistory({
      inputText: lastRunInput,
      result: analysis.state.data,
    });
    setHighlightId(entry.id);
    if (highlightTimer.current !== null) {
      window.clearTimeout(highlightTimer.current);
    }
    highlightTimer.current = window.setTimeout(() => setHighlightId(null), 250);
  }, [analysis.state, addHistory, lastRunInput]);

  useEffect(() => {
    return () => {
      if (highlightTimer.current !== null) {
        window.clearTimeout(highlightTimer.current);
      }
    };
  }, []);

  const handleSubmit = useCallback(() => {
    const trimmed = text.trim();
    if (
      !trimmed ||
      analysis.state.status === "loading" ||
      trimmed.length > MAX_TEXT_LENGTH
    ) {
      return;
    }
    setLastRunInput(trimmed);
    setSavedHistoryId(null);
    runAnalysis(trimmed);
  }, [text, analysis.state.status, runAnalysis]);

  const handleClear = useCallback(() => {
    setText("");
    setSavedHistoryId(null);
    resetAnalysis();
  }, [resetAnalysis]);

  const handleSelectHistory = useCallback(
    (id: string) => {
      const entry = selectHistory(id);
      if (!entry) return;
      setText(entry.inputText);
      showSaved(entry.result, entry.timestamp);
      setSavedHistoryId(id);
    },
    [selectHistory, showSaved],
  );

  const submitDisabled =
    analysis.state.status === "loading" ||
    !text.trim() ||
    text.length > MAX_TEXT_LENGTH;

  // selectedId is id-based (not timestamp-based — timestamps can collide).
  // While viewing a saved entry, that row stays selected. After a fresh run,
  // savedHistoryId is null and only the brief flash via highlightId applies.
  const selectedId = savedHistoryId;

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <h1>Sentiment Analyzer</h1>
            <span className="tagline">
              Sentiment, emotions, and keywords from any text.
            </span>
          </div>
          <a
            className="gh-link"
            href="https://github.com"
            target="_blank"
            rel="noreferrer noopener"
            aria-label="View source on GitHub"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 16 16"
              aria-hidden="true"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
            <span>Source</span>
          </a>
        </div>
      </header>

      <main className="main">
        <div className="container">
          <div className="grid">
            <TextInput
              value={text}
              onChange={setText}
              onSubmit={handleSubmit}
              onClear={handleClear}
              disabled={analysis.state.status === "loading"}
              submitDisabled={submitDisabled}
            />
            <ResultsPanel
              state={analysis.state}
              elapsed={analysis.elapsed}
              onRetry={retryAnalysis}
            />
            <HistoryList
              items={history.items}
              selectedId={selectedId}
              highlightId={highlightId}
              onSelect={handleSelectHistory}
              onClear={clearHistory}
            />
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <p>
            History is saved on this device only. Text you analyze is sent to a
            serverless function and not stored.
          </p>
          <p>Built with React.</p>
        </div>
      </footer>
    </div>
  );
}
