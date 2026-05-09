// Integration test: proves the MSW handlers and the api client agree on the
// contract. Each test layers exactly one handler via `server.use(...)`, then
// calls the real `analyzeText` (no fetch stubbing) and checks the surfaced
// ApiError shape.
import { describe, it, expect } from "vitest";
import { server } from "./server";
import {
  analyzeHandler,
  buildResponse,
  envelopeErrorHandler,
  networkErrorHandler,
  serverErrorHandler,
  throttledHandler,
  ANALYZE_URL,
} from "./handlers";
import { analyzeText, ApiClientError } from "@/api/client";

describe("MSW handlers integration: success", () => {
  it("returns a backend-shaped 200 with all 7 emotion keys including neutral", async () => {
    server.use(analyzeHandler);
    const r = await analyzeText("I love this product, it's amazing!", {
      url: ANALYZE_URL,
    });
    expect(r.sentiment.label).toBe("positive");
    expect(r.sentiment.confidence).toBeGreaterThan(0);
    expect(Object.keys(r.emotions).sort()).toEqual([
      "anger",
      "disgust",
      "fear",
      "joy",
      "neutral",
      "sadness",
      "surprise",
    ]);
    expect(r.keywords.length).toBeGreaterThan(0);
    // YAKE-style: top keyword has the LOWEST score
    const sorted = [...r.keywords].sort((a, b) => a.score - b.score);
    expect(sorted[0]!.score).toBeLessThan(sorted[sorted.length - 1]!.score);
    expect(r.inputText).toContain("I love");
    expect(r.analyzedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("buildResponse helper produces a valid AnalysisResponse for fixture use", () => {
    const r = buildResponse("hello world");
    expect(typeof r.sentiment.label).toBe("string");
    expect(typeof r.sentiment.confidence).toBe("number");
    expect(typeof r.emotions.neutral).toBe("number");
    expect(r.inputText).toBe("hello world");
  });

  it("caps inputText echo at 200 characters", async () => {
    server.use(analyzeHandler);
    const r = await analyzeText("a".repeat(500), { url: ANALYZE_URL });
    expect(r.inputText.length).toBe(200);
  });
});

describe("MSW handlers integration: validation precedence (spec §5.2)", () => {
  it("EMPTY_INPUT for empty text", async () => {
    server.use(analyzeHandler);
    const err = await analyzeText("   ", { url: ANALYZE_URL }).catch(
      (e: unknown) => e,
    );
    expect((err as ApiClientError).api).toMatchObject({
      kind: "http",
      status: 400,
      error: { code: "EMPTY_INPUT", field: "text" },
    });
  });

  it("INPUT_TOO_LONG for text > 5000 chars", async () => {
    server.use(analyzeHandler);
    const err = await analyzeText("x".repeat(5001), { url: ANALYZE_URL }).catch(
      (e: unknown) => e,
    );
    expect((err as ApiClientError).api).toMatchObject({
      kind: "http",
      status: 422,
      error: { code: "INPUT_TOO_LONG", field: "text" },
    });
  });
});

describe("MSW handlers integration: forced error envelopes", () => {
  it.each([
    [400, "INVALID_JSON", "text"],
    [400, "EMPTY_INPUT", "text"],
    [422, "INPUT_TOO_LONG", "text"],
    [405, "METHOD_NOT_ALLOWED", "method"],
  ] as const)(
    "envelopeErrorHandler(%i, %s) surfaces kind: 'http' with the right code",
    async (status, code, field) => {
      server.use(envelopeErrorHandler(status, code, "forced", field));
      const err = await analyzeText("x", { url: ANALYZE_URL }).catch(
        (e: unknown) => e,
      );
      expect((err as ApiClientError).api).toMatchObject({
        kind: "http",
        status,
        error: { code, field, message: "forced" },
      });
    },
  );
});

describe("MSW handlers integration: non-envelope responses", () => {
  it("throttledHandler → kind: 'throttled' (body never parsed)", async () => {
    server.use(throttledHandler);
    const err = await analyzeText("x", { url: ANALYZE_URL }).catch(
      (e: unknown) => e,
    );
    expect((err as ApiClientError).api).toEqual({ kind: "throttled", status: 429 });
  });

  it.each([500, 502, 503, 504] as const)(
    "serverErrorHandler(%i) → kind: 'server' with status",
    async (status) => {
      server.use(serverErrorHandler(status));
      const err = await analyzeText("x", { url: ANALYZE_URL }).catch(
        (e: unknown) => e,
      );
      expect((err as ApiClientError).api).toEqual({ kind: "server", status });
    },
  );

  it("networkErrorHandler → kind: 'network'", async () => {
    server.use(networkErrorHandler);
    const err = await analyzeText("x", { url: ANALYZE_URL }).catch(
      (e: unknown) => e,
    );
    expect((err as ApiClientError).api).toEqual({ kind: "network" });
  });
});
