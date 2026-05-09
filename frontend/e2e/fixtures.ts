// Self-contained fixtures for Playwright e2e tests. Kept inline (rather than
// re-exporting `buildResponse` from src/test/handlers.ts) so Playwright's TS
// loader doesn't have to resolve the `@/` path alias used inside that file.

import type { Route } from "@playwright/test";

export const ANALYZE_URL = "https://lambda.test/analyze";

export interface FakeAnalysis {
  sentiment: { label: "positive" | "negative" | "neutral"; confidence: number };
  emotions: {
    anger: number;
    disgust: number;
    fear: number;
    joy: number;
    neutral: number;
    sadness: number;
    surprise: number;
  };
  keywords: { term: string; score: number }[];
  inputText: string;
  analyzedAt: string;
}

export function fakeAnalysis(text: string): FakeAnalysis {
  return {
    sentiment: { label: "positive", confidence: 0.83 },
    emotions: {
      anger: 0.01,
      disgust: 0.01,
      fear: 0.02,
      joy: 0.78,
      neutral: 0.1,
      sadness: 0.05,
      surprise: 0.03,
    },
    keywords: [
      { term: "amazing", score: 0.05 },
      { term: "love", score: 0.2 },
      { term: "incredible", score: 0.3 },
    ],
    inputText: text.slice(0, 200),
    analyzedAt: new Date().toISOString(),
  };
}

export async function fulfillSuccess(route: Route): Promise<void> {
  const body = route.request().postDataJSON() as { text: string };
  await route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify(fakeAnalysis(body.text)),
  });
}
