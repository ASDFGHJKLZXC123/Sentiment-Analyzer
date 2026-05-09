import type { EmotionKey } from "@/api/types";

// `neutral` reuses the sentiment-neutral token (--color-neutral) since the
// design system's emotion palette in tokens.css §5.1 only covers the 6 legacy
// emotions. Adding a dedicated --color-emotion-neutral was ruled out as a
// design change beyond the scope of this port.
export const EMOTION_COLORS: Record<EmotionKey, string> = {
  joy: "var(--color-emotion-joy)",
  sadness: "var(--color-emotion-sadness)",
  anger: "var(--color-emotion-anger)",
  fear: "var(--color-emotion-fear)",
  surprise: "var(--color-emotion-surprise)",
  disgust: "var(--color-emotion-disgust)",
  neutral: "var(--color-neutral)",
};
