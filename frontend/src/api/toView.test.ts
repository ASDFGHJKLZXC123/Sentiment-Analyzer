import { describe, it, expect } from "vitest";
import { toView, invertKeywordScores } from "./toView";
import type { Emotions, AnalysisResponse, SentimentLabel } from "./types";

// Distinct values so the sort order is unambiguous (stable sort would otherwise
// fall back to EMOTION_KEYS order on ties, which would surprise readers).
const fullEmotions: Emotions = {
  anger: 0.01,
  disgust: 0.02,
  fear: 0.03,
  joy: 0.78,
  neutral: 0.1,
  sadness: 0.04,
  surprise: 0.025,
};

function baseResponse(overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  return {
    sentiment: { label: "positive", confidence: 0.5 },
    emotions: fullEmotions,
    keywords: [],
    inputText: "x",
    analyzedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("toView: sentiment", () => {
  it.each([
    ["positive", "Positive"],
    ["negative", "Negative"],
    ["neutral", "Neutral"],
  ] as Array<[SentimentLabel, string]>)("title-cases %s → %s", (label, expected) => {
    const view = toView(baseResponse({ sentiment: { label, confidence: 0.5 } }));
    expect(view.sentiment).toBe(expected);
    expect(view.confidence).toBe(0.5);
  });
});

describe("toView: emotions", () => {
  it("returns sorted-desc array of all 7 keys including neutral", () => {
    const view = toView(baseResponse());
    expect(view.emotions).toHaveLength(7);
    expect(view.emotions.map((e) => e.key)).toEqual([
      "joy",
      "neutral",
      "sadness",
      "fear",
      "surprise",
      "disgust",
      "anger",
    ]);
    expect(view.emotions[0]).toEqual({ key: "joy", label: "Joy", score: 0.78 });
    expect(view.emotions.map((e) => e.label).sort()).toEqual([
      "Anger",
      "Disgust",
      "Fear",
      "Joy",
      "Neutral",
      "Sadness",
      "Surprise",
    ]);
  });

  it("falls back to 0 for keys missing in a malformed response", () => {
    const malformed = { joy: 0.9 } as unknown as Emotions;
    const view = toView(baseResponse({ emotions: malformed }));
    expect(view.emotions.find((e) => e.key === "joy")?.score).toBe(0.9);
    expect(view.emotions.find((e) => e.key === "anger")?.score).toBe(0);
  });
});

describe("invertKeywordScores: YAKE inversion", () => {
  it("returns [] for empty input", () => {
    expect(invertKeywordScores([])).toEqual([]);
  });

  it("smallest raw score gets weight 1, largest gets weight 0", () => {
    const result = invertKeywordScores([
      { term: "best", score: 0.05 },
      { term: "ok", score: 0.3 },
      { term: "filler", score: 0.5 },
    ]);
    expect(result.map((k) => k.term)).toEqual(["best", "ok", "filler"]);
    expect(result[0]!.weight).toBe(1);
    expect(result[2]!.weight).toBe(0);
    expect(result[1]!.weight).toBeCloseTo(1 - (0.3 - 0.05) / (0.5 - 0.05), 5);
  });

  it("preserves rawScore from the response", () => {
    const result = invertKeywordScores([
      { term: "x", score: 0.123 },
      { term: "y", score: 0.456 },
    ]);
    expect(result[0]!.rawScore).toBe(0.123);
    expect(result[1]!.rawScore).toBe(0.456);
  });

  it("returns weight 1 for a single keyword", () => {
    expect(invertKeywordScores([{ term: "x", score: 0.42 }])).toEqual([
      { term: "x", rawScore: 0.42, weight: 1 },
    ]);
  });

  it("returns weight 1 for all when scores are equal (no division by zero)", () => {
    const result = invertKeywordScores([
      { term: "a", score: 0.1 },
      { term: "b", score: 0.1 },
      { term: "c", score: 0.1 },
    ]);
    expect(result.every((k) => k.weight === 1)).toBe(true);
  });

  it("preserves order from the response (does not sort)", () => {
    const result = invertKeywordScores([
      { term: "high-raw-low-weight", score: 0.5 },
      { term: "low-raw-high-weight", score: 0.05 },
    ]);
    expect(result.map((k) => k.term)).toEqual([
      "high-raw-low-weight",
      "low-raw-high-weight",
    ]);
    expect(result[0]!.weight).toBe(0);
    expect(result[1]!.weight).toBe(1);
  });

  it("handles a multi-word YAKE term ('Amazing experience') without splitting", () => {
    const result = invertKeywordScores([
      { term: "Amazing experience", score: 0.042 },
      { term: "Amazing", score: 0.201 },
    ]);
    expect(result[0]!.term).toBe("Amazing experience");
    expect(result[0]!.weight).toBe(1);
  });
});

describe("toView: pass-through fields", () => {
  it("preserves inputText and analyzedAt", () => {
    const v = toView(
      baseResponse({
        inputText: "echoed",
        analyzedAt: "2026-05-07T12:34:56Z",
      }),
    );
    expect(v.inputText).toBe("echoed");
    expect(v.analyzedAt).toBe("2026-05-07T12:34:56Z");
  });
});
