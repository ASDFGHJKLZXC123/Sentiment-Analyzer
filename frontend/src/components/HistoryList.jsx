// HistoryList: list of past sessions with relative time + preview + sentiment badge

function HistoryList({ history, selectedId, highlightId, onSelect, onClear }) {
  const [confirming, setConfirming] = React.useState(false);

  // Tick to keep relative timestamps fresh
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick(x => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const askClear = () => setConfirming(true);
  const cancelClear = () => setConfirming(false);
  const confirmClear = () => { onClear(); setConfirming(false); };

  return (
    <section className="region-history" aria-labelledby="history-heading">
      <div className="card">
        <div className="card-inner">
          <div className="history-head">
            <h2 id="history-heading" className="section-heading" style={{ margin: 0 }}>
              History
              {history.length > 0 && (
                <span style={{
                  marginLeft: 8,
                  fontSize: "var(--text-sm)",
                  color: "var(--color-text-mute)",
                  fontWeight: 500,
                }}>
                  ({history.length})
                </span>
              )}
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                className="btn btn-tertiary"
                style={{ minHeight: 36, padding: "0 10px", fontSize: "var(--text-sm)" }}
                onClick={askClear}
              >
                Clear
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="history-empty">Your past analyses will appear here.</p>
          ) : (
            <ul className="history-list" role="list">
              {history.map((item) => {
                const sel = item.id === selectedId;
                const hl  = item.id === highlightId && !sel;
                const cls = `history-item${sel ? " is-selected" : ""}${hl ? " is-new" : ""}`;
                const preview = item.input.length > 80
                  ? item.input.slice(0, 80).trimEnd() + "…"
                  : item.input;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cls}
                      onClick={() => onSelect(item.id)}
                      aria-current={sel ? "true" : undefined}
                    >
                      <div className="hi-meta">
                        <span className="hi-time">{relativeTime(item.ts)}</span>
                        <SentimentBadgeMini
                          sentiment={item.result.sentiment}
                          confidence={item.result.confidence}
                        />
                      </div>
                      <div className="hi-preview">{preview}</div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          title="Clear all history?"
          body="This removes every saved analysis on this device. It can't be undone."
          confirmLabel="Clear history"
          onConfirm={confirmClear}
          onCancel={cancelClear}
        />
      )}
    </section>
  );
}

// Compact sentiment badge for inline use in history rows
function SentimentBadgeMini({ sentiment, confidence }) {
  const cls = `sentiment-badge sentiment-${sentiment.toLowerCase()}`;
  return (
    <span
      className={cls}
      style={{
        fontSize: "var(--text-xs)",
        padding: "3px 8px",
        gap: 4,
      }}
    >
      <SentimentIcon sentiment={sentiment} size={12} />
      <span style={{ fontWeight: 600 }}>{sentiment}</span>
      <span style={{ opacity: 0.8, fontWeight: 500 }}>
        {Math.round(confidence * 100)}%
      </span>
    </span>
  );
}

function ConfirmDialog({ title, body, confirmLabel, onConfirm, onCancel }) {
  const cancelRef = React.useRef(null);
  React.useEffect(() => {
    cancelRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div className="dialog-backdrop" role="presentation" onClick={onCancel}>
      <div
        className="dialog"
        role="alertdialog"
        aria-labelledby="dlg-title"
        aria-describedby="dlg-body"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="dlg-title">{title}</h3>
        <p id="dlg-body">{body}</p>
        <div className="dialog-actions">
          <button
            type="button"
            ref={cancelRef}
            className="btn-secondary"
            onClick={onCancel}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn-danger"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

window.HistoryList = HistoryList;
