// Tier-2+ loading placeholders. Each skeleton matches the layout of the
// content it replaces so the swap-in feels like a fade rather than a jump.

export function SkeletonBadge() {
  return <div className="skeleton sk-pill" aria-hidden="true" />;
}

export function SkeletonChart() {
  const widths = [100, 78, 60, 45, 30, 20];
  return (
    <div>
      <div
        className="skeleton sk-bar"
        style={{ width: 80, marginBottom: 12 }}
        aria-hidden="true"
      />
      <div className="sk-stack">
        {widths.map((w, i) => (
          <div className="emotion-row" key={i}>
            <div className="skeleton sk-bar" style={{ width: 70 }} aria-hidden="true" />
            <div
              className="skeleton sk-bar-h"
              style={{ width: `${w}%` }}
              aria-hidden="true"
            />
            <div
              className="skeleton sk-bar"
              style={{ width: 40, marginLeft: "auto" }}
              aria-hidden="true"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonKeywords() {
  const widths = [80, 60, 70, 50, 90, 55, 65, 45];
  return (
    <div>
      <div
        className="skeleton sk-bar"
        style={{ width: 80, marginBottom: 12 }}
        aria-hidden="true"
      />
      <div className="kw-cloud">
        {widths.map((w, i) => (
          <div
            key={i}
            className="skeleton"
            style={{ height: 28, width: w, borderRadius: 4 }}
            aria-hidden="true"
          />
        ))}
      </div>
    </div>
  );
}
