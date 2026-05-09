import { http, HttpResponse } from "msw";
import {
  MAX_TEXT_LENGTH,
  SERVER_ECHO_MAX,
  type AnalysisResponse,
  type Emotions,
  type ErrorCode,
  type ErrorField,
  type Keyword,
  type SentimentLabel,
  type ServerErrorResponse,
} from "@/api/types";

// Per spec §10: tests opt into specific handlers via server.use(...).
// No global default handlers — handlers.ts only exports the factories.

export const ANALYZE_URL = "https://lambda.test/analyze";

// Default content-generating handler that mirrors the backend's validation
// precedence (phase2-backend.md §"Function URL event handling"). Use this for
// happy-path integration tests; layer error handlers on top via server.use(...).
export const analyzeHandler = http.post(ANALYZE_URL, async ({ request }) => {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorEnvelope(400, "INVALID_JSON", "Body is not valid JSON.", "text");
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorEnvelope(400, "INVALID_JSON", "Body must be a JSON object.", "text");
  }
  const text = (body as Record<string, unknown>).text;
  if (typeof text !== "string" || !text.trim()) {
    return errorEnvelope(
      400,
      "EMPTY_INPUT",
      "Field 'text' is required and cannot be empty or whitespace-only.",
      "text",
    );
  }
  if (text.length > MAX_TEXT_LENGTH) {
    return errorEnvelope(
      422,
      "INPUT_TOO_LONG",
      `Field 'text' exceeds ${MAX_TEXT_LENGTH} characters.`,
      "text",
    );
  }
  return HttpResponse.json(buildResponse(text));
});

// Force a specific handler-owned 4xx (EMPTY_INPUT / INVALID_JSON / INPUT_TOO_LONG / METHOD_NOT_ALLOWED).
export function envelopeErrorHandler(
  status: number,
  code: ErrorCode,
  message: string,
  field: ErrorField,
) {
  return http.post(ANALYZE_URL, () => errorEnvelope(status, code, message, field));
}

// Service-generated 429. Body is intentionally not the handler envelope —
// matches AWS reserved-concurrency behavior described in phase2-backend.md.
export const throttledHandler = http.post(
  ANALYZE_URL,
  () => new HttpResponse("Too many requests", { status: 429 }),
);

// 5xx with no envelope guarantee.
export function serverErrorHandler(status = 502) {
  return http.post(
    ANALYZE_URL,
    () => new HttpResponse("Server error", { status }),
  );
}

// Network-level failure (fetch rejects, no response).
export const networkErrorHandler = http.post(ANALYZE_URL, () => HttpResponse.error());

// ---- Response builders ----

function errorEnvelope(
  status: number,
  code: ErrorCode,
  message: string,
  field: ErrorField,
) {
  const body: ServerErrorResponse = { error: { code, message, field } };
  return HttpResponse.json(body, { status });
}

// Build a backend-shaped 200 response from text. Exported so tests can build
// fixtures without going through MSW (e.g., for hook tests that mock analyzeText).
export function buildResponse(text: string): AnalysisResponse {
  const { label, confidence, emotions, keywords } = generate(text);
  return {
    sentiment: { label, confidence },
    emotions,
    keywords,
    inputText: text.slice(0, SERVER_ECHO_MAX),
    analyzedAt: new Date().toISOString(),
  };
}

// ---- Content generation ----
// Port of the legacy mock (frontend/src/hooks/useAnalysis.jsx:12-88), reshaped
// to the backend output: 7-key emotions object including `neutral`, lowercase
// sentiment label, raw YAKE-style keyword scores (lower = more relevant).

const POSITIVE_WORDS = new Set(
  "love great amazing fantastic wonderful excellent best happy delighted joy thrilled perfect good awesome brilliant".split(
    " ",
  ),
);
const NEGATIVE_WORDS = new Set(
  "hate terrible awful worst bad horrible broken disappointed angry useless frustrated failed annoying poor ruined".split(
    " ",
  ),
);
const STOPWORDS = new Set(
  "a an and the of to is it i you we they on in for with that this be was were are have has had not but or so very just really my your".split(
    " ",
  ),
);

function generate(text: string): {
  label: SentimentLabel;
  confidence: number;
  emotions: Emotions;
  keywords: Keyword[];
} {
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];

  let pos = 0;
  let neg = 0;
  for (const w of words) {
    if (POSITIVE_WORDS.has(w)) pos++;
    if (NEGATIVE_WORDS.has(w)) neg++;
  }
  pos += (text.match(/!/g)?.length ?? 0) * 0.3;

  let label: SentimentLabel;
  let confidence: number;
  if (pos > neg) {
    label = "positive";
    confidence = Math.min(0.95, 0.55 + (pos - neg) * 0.08);
  } else if (neg > pos) {
    label = "negative";
    confidence = Math.min(0.95, 0.55 + (neg - pos) * 0.08);
  } else {
    label = "neutral";
    confidence = 0.65;
  }

  // Stable seeded PRNG so the same input always produces the same response
  // shape — makes integration tests deterministic without needing fixtures.
  const seed = Array.from(text).reduce((a, c) => (a + c.charCodeAt(0)) % 9973, 0);
  const r = (n: number) => ((seed * (n + 1) * 7919) % 1000) / 1000;

  const emotions: Emotions =
    label === "positive"
      ? {
          joy: 0.55 + r(1) * 0.3,
          surprise: 0.2 + r(2) * 0.25,
          sadness: 0.05 + r(3) * 0.1,
          anger: 0.03 + r(4) * 0.05,
          fear: 0.05 + r(5) * 0.08,
          disgust: 0.02 + r(6) * 0.05,
          neutral: 0.1 + r(7) * 0.15,
        }
      : label === "negative"
        ? {
            anger: 0.4 + r(1) * 0.3,
            sadness: 0.3 + r(2) * 0.25,
            disgust: 0.15 + r(3) * 0.2,
            fear: 0.1 + r(4) * 0.15,
            surprise: 0.08 + r(5) * 0.1,
            joy: 0.02 + r(6) * 0.05,
            neutral: 0.05 + r(7) * 0.1,
          }
        : {
            neutral: 0.4 + r(1) * 0.2,
            surprise: 0.15 + r(2) * 0.1,
            joy: 0.1 + r(3) * 0.1,
            sadness: 0.1 + r(4) * 0.1,
            fear: 0.08 + r(5) * 0.1,
            anger: 0.07 + r(6) * 0.1,
            disgust: 0.06 + r(7) * 0.08,
          };

  // Frequency × length-weight, then mapped to YAKE-style 0.04-0.5 (lower = better).
  const freq: Record<string, number> = {};
  for (const w of words) {
    if (STOPWORDS.has(w) || w.length < 4) continue;
    freq[w] = (freq[w] ?? 0) + 1;
  }
  const ranked = Object.entries(freq)
    .map(([term, count]) => ({ term, raw: count * (1 + term.length / 12) }))
    .sort((a, b) => b.raw - a.raw)
    .slice(0, 12);
  const keywords: Keyword[] = ranked.map((k, i) => ({
    term: k.term,
    score: 0.04 + (i / Math.max(ranked.length - 1, 1)) * 0.46,
  }));

  return { label, confidence, emotions, keywords };
}
