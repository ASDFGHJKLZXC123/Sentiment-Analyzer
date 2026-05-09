import {
  EMOTION_KEYS,
  type AnalysisResponse,
  type EmotionKey,
  type Keyword,
  type SentimentLabel,
} from "./types";

// Display values used by components. Components consume AnalysisView; the API
// shape (AnalysisResponse) stays internal to the api/ layer.

export type SentimentDisplay = "Positive" | "Negative" | "Neutral";

export interface EmotionView {
  key: EmotionKey;
  label: string;
  score: number;
}

export interface KeywordView {
  term: string;
  // Original YAKE score (lower = more relevant). Preserved for tests/debug.
  rawScore: number;
  // Inverted + min-max normalized to [0, 1]. Higher = larger chip.
  weight: number;
}

export interface AnalysisView {
  sentiment: SentimentDisplay;
  confidence: number;
  emotions: EmotionView[]; // sorted desc by score
  keywords: KeywordView[]; // order preserved from response
  inputText: string;
  analyzedAt: string;
}

const SENTIMENT_DISPLAY: Record<SentimentLabel, SentimentDisplay> = {
  positive: "Positive",
  negative: "Negative",
  neutral: "Neutral",
};

const EMOTION_LABELS: Record<EmotionKey, string> = {
  anger: "Anger",
  disgust: "Disgust",
  fear: "Fear",
  joy: "Joy",
  neutral: "Neutral",
  sadness: "Sadness",
  surprise: "Surprise",
};

export function toView(r: AnalysisResponse): AnalysisView {
  const emotions: EmotionView[] = EMOTION_KEYS.map((key) => ({
    key,
    label: EMOTION_LABELS[key],
    // `?? 0` is defensive — type says number but a malformed response could omit a key.
    score: r.emotions[key] ?? 0,
  })).sort((a, b) => b.score - a.score);

  return {
    sentiment: SENTIMENT_DISPLAY[r.sentiment.label],
    confidence: r.sentiment.confidence,
    emotions,
    keywords: invertKeywordScores(r.keywords),
    inputText: r.inputText,
    analyzedAt: r.analyzedAt,
  };
}

// YAKE: lower score = more relevant. Map to a chip-sizing weight in [0, 1]
// where higher = larger. Min-max normalize across the response so the most
// relevant keyword is always weight 1 regardless of YAKE's absolute scale.
export function invertKeywordScores(keywords: Keyword[]): KeywordView[] {
  if (keywords.length === 0) return [];
  let min = Infinity;
  let max = -Infinity;
  for (const k of keywords) {
    if (k.score < min) min = k.score;
    if (k.score > max) max = k.score;
  }
  const range = max - min;
  return keywords.map((k) => ({
    term: k.term,
    rawScore: k.score,
    weight: range === 0 ? 1 : 1 - (k.score - min) / range,
  }));
}
