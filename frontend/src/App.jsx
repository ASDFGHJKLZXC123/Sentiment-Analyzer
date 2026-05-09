// App shell — composes everything together with optional Tweaks panel for testing states

const { useState: useState2, useEffect: useEffect2, useRef: useRef2 } = React;

const APP_DEFAULTS = /*EDITMODE-BEGIN*/{
  "errorMode": "none",
  "latencyMode": "auto"
}/*EDITMODE-END*/;

function App() {
  const a = useAnalysis();
  const [text, setText] = useState2("");
  const [tweaks, setTweaksLocal] = useState2(APP_DEFAULTS);
  const [editOpen, setEditOpen] = useState2(false);

  // Tweaks protocol
  useEffect2(() => {
    const onMsg = (e) => {
      const d = e.data || {};
      if (d.type === "__activate_edit_mode") setEditOpen(true);
      if (d.type === "__deactivate_edit_mode") setEditOpen(false);
    };
    window.addEventListener("message", onMsg);
    window.parent.postMessage({ type: "__edit_mode_available" }, "*");
    return () => window.removeEventListener("message", onMsg);
  }, []);

  const setTweak = (k, v) => {
    setTweaksLocal(prev => {
      const next = { ...prev, [k]: v };
      window.parent.postMessage({ type: "__edit_mode_set_keys", edits: { [k]: v } }, "*");
      return next;
    });
  };

  // Selected id (for highlight in history)
  const selectedId = a.savedFromTime != null
    ? a.history.find(h => h.ts === a.savedFromTime)?.id
    : a.highlightId;

  const handleSubmit = () => {
    if (!text.trim() || a.status === "loading") return;
    a.runAnalysis(text.trim(), tweaks.errorMode, tweaks.latencyMode);
  };

  const handleClear = () => {
    setText("");
    a.reset();
  };

  const handleSelectHistory = (id) => {
    const item = a.history.find(h => h.id === id);
    if (!item) return;
    setText(item.input);
    a.selectHistory(id);
  };

  const submitDisabled =
    a.status === "loading" ||
    !text.trim() ||
    text.length > MAX_LEN;

  return (
    <div className="app">
      <header className="header">
        <div className="container header-inner">
          <div className="brand">
            <h1>Sentiment Analyzer</h1>
            <span className="tagline">Sentiment, emotions, and keywords from any text.</span>
          </div>
          <a className="gh-link" href="https://github.com" target="_blank" rel="noreferrer noopener" aria-label="View source on GitHub">
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/>
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
              disabled={a.status === "loading"}
              submitDisabled={submitDisabled}
            />
            <ResultsPanel
              status={a.status}
              elapsed={a.elapsed}
              result={a.result}
              error={a.error}
              savedFromTime={a.savedFromTime}
              onRetry={() => a.retry(tweaks.errorMode, tweaks.latencyMode)}
            />
            <HistoryList
              history={a.history}
              selectedId={selectedId}
              highlightId={a.highlightId}
              onSelect={handleSelectHistory}
              onClear={a.clearHistory}
            />
          </div>
        </div>
      </main>

      <footer className="footer">
        <div className="container footer-inner">
          <p>History is saved on this device only. Text you analyze is sent to a serverless function and not stored.</p>
          <p>Built with React. Designed to WCAG AA. Honors your reduced-motion preference.</p>
        </div>
      </footer>

      {editOpen && (
        <TweaksPanel
          tweaks={tweaks}
          setTweak={setTweak}
          onClose={() => {
            setEditOpen(false);
            window.parent.postMessage({ type: "__edit_mode_dismissed" }, "*");
          }}
        />
      )}
    </div>
  );
}

// Inline Tweaks panel — exposes test hooks for the loading & error states
function TweaksPanel({ tweaks, setTweak, onClose }) {
  return (
    <div
      role="dialog"
      aria-label="Tweaks"
      style={{
        position: "fixed",
        right: 16,
        bottom: 16,
        width: 280,
        background: "var(--color-surface)",
        border: "1px solid var(--color-border)",
        borderRadius: "var(--radius-md)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
        padding: 16,
        zIndex: 40,
        fontSize: 14,
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <strong style={{ fontSize: 16 }}>Tweaks</strong>
        <button onClick={onClose} aria-label="Close" style={{ padding: 4, color: "var(--color-text-mute)" }}>✕</button>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: "block", color: "var(--color-text-mute)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Latency
        </label>
        <select
          value={tweaks.latencyMode}
          onChange={(e) => setTweak("latencyMode", e.target.value)}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 4 }}
        >
          <option value="auto">Auto (cold once, then warm)</option>
          <option value="warm">Always warm (~1s)</option>
          <option value="cold">Always cold (~8s)</option>
          <option value="slow">Stuck (12s)</option>
        </select>
      </div>

      <div>
        <label style={{ display: "block", color: "var(--color-text-mute)", fontSize: 12, marginBottom: 6, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Force error
        </label>
        <select
          value={tweaks.errorMode}
          onChange={(e) => setTweak("errorMode", e.target.value)}
          style={{ width: "100%", padding: "8px 10px", border: "1px solid var(--color-border)", borderRadius: 4 }}
        >
          <option value="none">None</option>
          <option value="network">Network / offline</option>
          <option value="timeout">Timeout</option>
          <option value="4xx">HTTP 4xx (input)</option>
          <option value="5xx">HTTP 5xx (server)</option>
        </select>
      </div>

      <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12, color: "var(--color-text-mute)" }}>
        Affects the next Analyze. Use to demo loading tiers and error states.
      </p>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
