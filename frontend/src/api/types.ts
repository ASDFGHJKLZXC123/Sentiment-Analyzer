// Mirrors the deployed backend contract field-for-field. Source of truth:
//   - Response (200) and error envelope: docs/phase2-backend.md §API contract
//   - Validation precedence + 429 outside-envelope: docs/phase2-backend.md
//     §"Function URL event handling" + the contract notes block
// If this file changes, update MSW fixtures and docs/phase2-backend.md in the same PR.

export const SENTIMENT_LABELS = ["positive", "negative", "neutral"] as const;
export type SentimentLabel = (typeof SENTIMENT_LABELS)[number];

export interface Sentiment {
  label: SentimentLabel;
  confidence: number;
}

export const EMOTION_KEYS = [
  "anger",
  "disgust",
  "fear",
  "joy",
  "neutral",
  "sadness",
  "surprise",
] as const;
export type EmotionKey = (typeof EMOTION_KEYS)[number];

// Backend always emits all 7 keys; runtime validator below only confirms the
// outer object shape, not per-key presence — see toView() for `?? 0` fallback.
export type Emotions = Record<EmotionKey, number>;

export interface Keyword {
  term: string;
  // Raw YAKE score. Lower = more relevant. The frontend inverts this for
  // visual sizing — see toView.invertKeywordScores.
  score: number;
}

export interface AnalysisResponse {
  sentiment: Sentiment;
  emotions: Emotions;
  keywords: Keyword[];
  // Server-echoed input, capped at SERVER_ECHO_MAX characters.
  inputText: string;
  // ISO 8601 UTC timestamp.
  analyzedAt: string;
}

// Server error envelope. `field` is always emitted (backend/lambda_function.py:57-63).
export const ERROR_CODES = [
  "EMPTY_INPUT",
  "INPUT_TOO_LONG",
  "INVALID_JSON",
  "METHOD_NOT_ALLOWED",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export const ERROR_FIELDS = ["text", "method"] as const;
export type ErrorField = (typeof ERROR_FIELDS)[number];

export interface ServerError {
  code: ErrorCode;
  message: string;
  field: ErrorField;
}

export interface ServerErrorResponse {
  error: ServerError;
}

// Limits — single source of truth for the frontend.
export const MAX_TEXT_LENGTH = 5000; // server INPUT_TOO_LONG threshold (>5000)
export const SERVER_ECHO_MAX = 200;
export const REQUEST_TIMEOUT_MS = 30_000; // 30s; pads cold-start tail latency
