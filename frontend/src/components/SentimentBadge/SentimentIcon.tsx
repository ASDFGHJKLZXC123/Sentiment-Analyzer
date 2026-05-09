import type { SentimentDisplay } from "@/api/toView";

interface Props {
  sentiment: SentimentDisplay;
  size?: number;
}

export function SentimentIcon({ sentiment, size = 18 }: Props) {
  if (sentiment === "Positive") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none">
        <path
          d="M3.5 8.5L6.5 11.5L12.5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (sentiment === "Negative") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none">
        <path
          d="M4 4L12 12M12 4L4 12"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" fill="none">
      <path d="M3.5 8H12.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
