// Atom components: SentimentBadge, EmotionChart, KeywordCloud, Skeletons, Spinner

function SentimentIcon({ sentiment, size = 18 }) {
  const s = size;
  if (sentiment === "Positive") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" fill="none">
        <path d="M3.5 8.5L6.5 11.5L12.5 5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    );
  }
  if (sentiment === "Negative") {
    return (
      <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" fill="none">
        <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    );
  }
  // Neutral — minus
  return (
    <svg width={s} height={s} viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path d="M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function SentimentBadge({ sentiment, confidence }) {
  const cls = `sentiment-badge sentiment-${sentiment.toLowerCase()}`;
  const pct = Math.round(confidence * 100);
  return (
    <span className={cls} role="status">
      <SentimentIcon sentiment={sentiment} size={20} />
      <span className="sb-label">{sentiment}</span>
      <span className="sb-pct">{pct}% confidence</span>
    </span>
  );
}

const EMOTION_COLORS = {
  Joy:      "var(--color-emotion-joy)",
  Sadness:  "var(--color-emotion-sadness)",
  Anger:    "var(--color-emotion-anger)",
  Fear:     "var(--color-emotion-fear)",
  Surprise: "var(--color-emotion-surprise)",
  Disgust:  "var(--color-emotion-disgust)",
};

function EmotionChart({ emotions }) {
  return (
    <div>
      <h3 className="result-block-label">Emotions</h3>
      <div className="emotion-chart" role="img" aria-label="Emotion scores bar chart. Use the table below for exact values.">
        {emotions.map((e) => {
          const pct = Math.round(e.score * 100);
          return (
            <div className="emotion-row" key={e.label}>
              <span className="e-name">{e.label}</span>
              <div className="emotion-bar-track" aria-hidden="true">
                <div
                  className="emotion-bar-fill"
                  style={{ width: `${pct}%`, background: EMOTION_COLORS[e.label] }}
                />
              </div>
              <span className="e-pct">{pct}%</span>
            </div>
          );
        })}
      </div>
      <details className="details">
        <summary>Show as table</summary>
        <table>
          <thead>
            <tr><th scope="col">Emotion</th><th scope="col">Score</th></tr>
          </thead>
          <tbody>
            {emotions.map(e => (
              <tr key={e.label}>
                <td>{e.label}</td>
                <td>{Math.round(e.score * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function KeywordCloud({ keywords }) {
  if (!keywords.length) {
    return (
      <div>
        <h3 className="result-block-label">Keywords</h3>
        <p style={{ margin: 0, fontSize: "var(--text-sm)", color: "var(--color-text-mute)" }}>
          No standout keywords in this text.
        </p>
      </div>
    );
  }
  // Buckets: top 1–3 = lg, next 4 = base, rest = sm
  return (
    <div>
      <h3 className="result-block-label">Keywords</h3>
      <div className="kw-cloud">
        {keywords.map((k, i) => {
          const cls = i < 3 ? "kw kw-lg" : i < 7 ? "kw kw-base" : "kw kw-sm";
          return <span key={k.term} className={cls}>{k.term}</span>;
        })}
      </div>
    </div>
  );
}

// ---- Loading skeletons (tier-specific) ----
function SkeletonBadge() {
  return <div className="skeleton sk-pill" aria-hidden="true" />;
}

function SkeletonChart() {
  return (
    <div>
      <div className="skeleton sk-bar" style={{ width: 80, marginBottom: 12 }} aria-hidden="true" />
      <div className="sk-stack">
        {[100, 78, 60, 45, 30, 20].map((w, i) => (
          <div className="emotion-row" key={i}>
            <div className="skeleton sk-bar" style={{ width: 70 }} aria-hidden="true" />
            <div className="skeleton sk-bar-h" style={{ width: `${w}%` }} aria-hidden="true" />
            <div className="skeleton sk-bar" style={{ width: 40, marginLeft: "auto" }} aria-hidden="true" />
          </div>
        ))}
      </div>
    </div>
  );
}

function SkeletonKeywords() {
  return (
    <div>
      <div className="skeleton sk-bar" style={{ width: 80, marginBottom: 12 }} aria-hidden="true" />
      <div className="kw-cloud">
        {[80, 60, 70, 50, 90, 55, 65, 45].map((w, i) => (
          <div key={i} className="skeleton" style={{ height: 28, width: w, borderRadius: 4 }} aria-hidden="true" />
        ))}
      </div>
    </div>
  );
}

function Spinner({ label }) {
  return (
    <div className="spinner-only" role="status" aria-label={label || "Loading"}>
      <div className="spinner" aria-hidden="true" />
      <span className="sr-only">{label || "Loading"}</span>
    </div>
  );
}

Object.assign(window, {
  SentimentIcon, SentimentBadge, EmotionChart, KeywordCloud,
  SkeletonBadge, SkeletonChart, SkeletonKeywords, Spinner,
  EMOTION_COLORS,
});
