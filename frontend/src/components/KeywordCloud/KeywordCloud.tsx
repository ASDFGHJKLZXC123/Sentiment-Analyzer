import type { KeywordView } from "@/api/toView";

interface Props {
  keywords: KeywordView[];
}

// Audit fix (§3, §5.1, §6.4): the legacy version sized chips by array index,
// which only worked because the legacy mock pre-sorted by score. The new
// view-model preserves response order, so we sort by `weight` here before
// bucketing — top 3 are largest, next 4 are base, the rest small.
export function KeywordCloud({ keywords }: Props) {
  if (keywords.length === 0) {
    return (
      <div>
        <h3 className="result-block-label">Keywords</h3>
        <p
          style={{
            margin: 0,
            fontSize: "var(--text-sm)",
            color: "var(--color-text-mute)",
          }}
        >
          No standout keywords in this text.
        </p>
      </div>
    );
  }
  const sorted = [...keywords].sort((a, b) => b.weight - a.weight);
  return (
    <div>
      <h3 className="result-block-label">Keywords</h3>
      <div className="kw-cloud">
        {sorted.map((k, i) => {
          const cls = i < 3 ? "kw kw-lg" : i < 7 ? "kw kw-base" : "kw kw-sm";
          return (
            <span key={k.term} className={cls}>
              {k.term}
            </span>
          );
        })}
      </div>
    </div>
  );
}
