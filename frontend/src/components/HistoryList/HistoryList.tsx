import { useEffect, useState } from "react";
import type { HistoryEntry } from "@/hooks/useHistory";
import { SentimentBadge } from "@/components/SentimentBadge/SentimentBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog/ConfirmDialog";
import { relativeTime } from "@/utils/relativeTime";

interface Props {
  items: HistoryEntry[];
  selectedId: string | null;
  highlightId: string | null;
  onSelect: (id: string) => void;
  onClear: () => void;
}

export function HistoryList({
  items,
  selectedId,
  highlightId,
  onSelect,
  onClear,
}: Props) {
  const [confirming, setConfirming] = useState(false);

  // Re-render every 30s so relative timestamps stay fresh.
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const askClear = () => setConfirming(true);
  const cancelClear = () => setConfirming(false);
  const confirmClear = () => {
    onClear();
    setConfirming(false);
  };

  return (
    <section className="region-history" aria-labelledby="history-heading">
      <div className="card">
        <div className="card-inner">
          <div className="history-head">
            <h2
              id="history-heading"
              className="section-heading"
              style={{ margin: 0 }}
            >
              History
              {items.length > 0 && (
                <span
                  style={{
                    marginLeft: 8,
                    fontSize: "var(--text-sm)",
                    color: "var(--color-text-mute)",
                    fontWeight: 500,
                  }}
                >
                  ({items.length})
                </span>
              )}
            </h2>
            {items.length > 0 && (
              <button
                type="button"
                className="btn btn-tertiary"
                style={{
                  minHeight: 36,
                  padding: "0 10px",
                  fontSize: "var(--text-sm)",
                }}
                onClick={askClear}
              >
                Clear
              </button>
            )}
          </div>

          {items.length === 0 ? (
            <p className="history-empty">Your past analyses will appear here.</p>
          ) : (
            // role="list" restores Safari/VoiceOver list semantics that
            // `list-style: none` strips; the jsx-a11y rule doesn't know that.
            // eslint-disable-next-line jsx-a11y/no-redundant-roles
            <ul className="history-list" role="list">
              {items.map((item) => {
                const sel = item.id === selectedId;
                const hl = item.id === highlightId && !sel;
                const cls = `history-item${sel ? " is-selected" : ""}${
                  hl ? " is-new" : ""
                }`;
                const preview =
                  item.inputText.length > 80
                    ? item.inputText.slice(0, 80).trimEnd() + "…"
                    : item.inputText;
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      className={cls}
                      onClick={() => onSelect(item.id)}
                      aria-current={sel ? "true" : undefined}
                    >
                      <div className="hi-meta">
                        <span className="hi-time">{relativeTime(item.timestamp)}</span>
                        <SentimentBadge
                          sentiment={item.result.sentiment}
                          confidence={item.result.confidence}
                          size="sm"
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
