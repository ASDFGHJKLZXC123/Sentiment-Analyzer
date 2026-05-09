// ResultsPanel: switches between empty / loading (3-tier) / success / error / saved-view

function relativeTime(ts) {
  const diff = Date.now() - ts;
  const s = Math.round(diff / 1000);
  if (s < 5) return "just now";
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}

function EmptyState() {
  return (
    <div className="results-empty">
      <svg className="icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect x="8" y="14" width="48" height="36" rx="4" stroke="currentColor" strokeWidth="2.5"/>
        <path d="M16 26h32M16 34h24M16 42h18" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"/>
      </svg>
      <h2>Paste some text to get started.</h2>
      <p>We'll analyze sentiment, detect emotions, and pull out keywords.</p>
    </div>
  );
}

function LoadingState({ elapsed }) {
  // Tier 1: 0–1.5s spinner only
  // Tier 2: 1.5–3s skeleton, no caption
  // Tier 3: 3–10s skeleton + warming caption
  // Tier 4: >10s skeleton + still working caption
  const tier1 = elapsed < 1500;
  const tier3 = elapsed >= 3000 && elapsed < 10000;
  const tier4 = elapsed >= 10000;

  if (tier1) {
    return <Spinner label="Analyzing" />;
  }

  return (
    <div>
      <div className="result-stack" aria-busy="true">
        <SkeletonBadge />
        <SkeletonChart />
        <SkeletonKeywords />
      </div>
      {(tier3 || tier4) && (
        <div className="loading-caption" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>
            {tier4
              ? "Still working… almost there."
              : "Warming up the model — this happens on the first request."}
          </span>
        </div>
      )}
    </div>
  );
}

const ERROR_COPY = {
  network: {
    title: "Can't reach the server.",
    body: "Check your connection and try again.",
    retry: true,
  },
  timeout: {
    title: "That took longer than expected.",
    body: "The model may be cold — try again.",
    retry: true,
  },
  "4xx": {
    title: "Your input couldn't be analyzed.",
    body: null, // filled from detail
    retry: false,
  },
  "5xx": {
    title: "Something went wrong on our end.",
    body: "This is rare — please try again.",
    retry: true,
  },
};

function ErrorBanner({ error, onRetry }) {
  const ref = React.useRef(null);
  React.useEffect(() => {
    ref.current?.focus();
  }, []);
  const meta = ERROR_COPY[error.kind] || ERROR_COPY["5xx"];
  const body = meta.body ?? error.detail ?? "Please edit your input and try again.";
  return (
    <div
      className="error-banner"
      role="alert"
      tabIndex={-1}
      ref={ref}
    >
      <div className="eb-head">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.5V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          <circle cx="8" cy="11.4" r="0.9" fill="currentColor"/>
        </svg>
        <span>{meta.title}</span>
      </div>
      <p>{body}</p>
      {meta.retry && (
        <div className="eb-actions">
          <button type="button" className="btn-retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

function SuccessContent({ result, savedFromTime, headingRef }) {
  // re-keyed so the live region announces on each new result
  return (
    <div className="result-stack">
      <h2
        id="results-heading"
        className="sr-only"
        tabIndex={-1}
        ref={headingRef}
      >
        Results: {result.sentiment}, {Math.round(result.confidence * 100)} percent confidence
      </h2>
      {savedFromTime != null && (
        <div className="saved-caption" aria-live="off">
          Showing saved result from {relativeTime(savedFromTime)}.
        </div>
      )}
      <div>
        <h3 className="result-block-label">Sentiment</h3>
        <SentimentBadge sentiment={result.sentiment} confidence={result.confidence} />
      </div>
      <EmotionChart emotions={result.emotions} />
      <KeywordCloud keywords={result.keywords} />
    </div>
  );
}

function ResultsPanel({ status, elapsed, result, error, savedFromTime, onRetry }) {
  const headingRef = React.useRef(null);

  // Move focus to results heading on success
  React.useEffect(() => {
    if (status === "success" && headingRef.current) {
      headingRef.current.focus();
    }
  }, [status, result]);

  return (
    <section
      className="region-results"
      aria-labelledby="results-section-heading"
    >
      <div className="card card-lg">
        <div className="card-inner">
          <h2 id="results-section-heading" className="section-heading">Results</h2>
          <div aria-live="polite" aria-atomic="false">
            {status === "idle" && <EmptyState />}
            {status === "loading" && <LoadingState elapsed={elapsed} />}
            {status === "error" && <ErrorBanner error={error} onRetry={onRetry} />}
            {status === "success" && result && (
              <SuccessContent
                result={result}
                savedFromTime={savedFromTime}
                headingRef={headingRef}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

window.ResultsPanel = ResultsPanel;
window.relativeTime = relativeTime;
