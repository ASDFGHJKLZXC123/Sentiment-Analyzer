import type { SentimentDisplay } from "@/api/toView";
import { SentimentIcon } from "./SentimentIcon";

interface Props {
  sentiment: SentimentDisplay;
  confidence: number;
  size?: "default" | "sm";
}

// Single component with a `size` variant — replaces the legacy SentimentBadge +
// SentimentBadgeMini split (audit §8). The "sm" variant drops the "confidence"
// suffix so it fits in compact contexts like history rows.
export function SentimentBadge({ sentiment, confidence, size = "default" }: Props) {
  const className = `sentiment-badge sentiment-${sentiment.toLowerCase()}${
    size === "sm" ? " sentiment-badge--sm" : ""
  }`;
  const pct = Math.round(confidence * 100);
  const iconSize = size === "sm" ? 12 : 20;
  return (
    <span className={className} role="status">
      <SentimentIcon sentiment={sentiment} size={iconSize} />
      <span className="sb-label">{sentiment}</span>
      <span className="sb-pct">
        {pct}%{size === "sm" ? "" : " confidence"}
      </span>
    </span>
  );
}
