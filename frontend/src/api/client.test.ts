import { describe, it, expect, afterEach, vi } from "vitest";
import { analyzeText, ApiClientError } from "./client";
import type { AnalysisResponse } from "./types";

const URL = "http://api.test.local/analyze";

const validResponse: AnalysisResponse = {
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
    { term: "Amazing", score: 0.041 },
    { term: "experience", score: 0.12 },
  ],
  inputText: "Amazing experience",
  analyzedAt: "2026-05-07T12:00:00Z",
};

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response | Promise<Response>,
) {
  const fn = vi.fn(handler);
  vi.stubGlobal("fetch", fn);
  return fn;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function neverResolvingFetch() {
  return mockFetch((_input, init) => {
    return new Promise((_, reject) => {
      // The DOMException constructor's second arg already sets `name`. Don't
      // try to overwrite it via Object.assign — `name` is non-writable on
      // DOMException, so the assignment throws TypeError under strict mode and
      // kills the reject() call silently.
      init?.signal?.addEventListener("abort", () => {
        reject(new DOMException("aborted", "AbortError"));
      });
    });
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("analyzeText: happy path", () => {
  it("returns the response body for 200", async () => {
    mockFetch(() => jsonResponse(200, validResponse));
    const result = await analyzeText("hello", { url: URL });
    expect(result).toEqual(validResponse);
  });

  it("POSTs JSON {text} with content-type to the configured URL", async () => {
    const fetchSpy = mockFetch(() => jsonResponse(200, validResponse));
    await analyzeText("hi there", { url: URL });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const call = fetchSpy.mock.calls[0]!;
    expect(call[0]).toBe(URL);
    expect(call[1]?.method).toBe("POST");
    expect(JSON.parse(call[1]?.body as string)).toEqual({ text: "hi there" });
    expect((call[1]?.headers as Record<string, string>)["Content-Type"]).toBe(
      "application/json",
    );
  });
});

describe("analyzeText: missing config", () => {
  it("throws a plain Error when neither opts.url nor VITE_LAMBDA_URL is set", async () => {
    vi.stubEnv("VITE_LAMBDA_URL", "");
    await expect(analyzeText("x")).rejects.toThrow(/no URL/);
  });
});

describe("analyzeText: 4xx envelope (kind: 'http')", () => {
  // These cases mirror the precedence rules from phase2-backend.md §"Function URL
  // event handling" — the client doesn't enforce precedence, but it must surface
  // each documented code with the right shape.
  const cases = [
    { status: 400, code: "EMPTY_INPUT", field: "text" },
    { status: 400, code: "INVALID_JSON", field: "text" },
    { status: 422, code: "INPUT_TOO_LONG", field: "text" },
    { status: 405, code: "METHOD_NOT_ALLOWED", field: "method" },
  ] as const;

  for (const c of cases) {
    it(`surfaces ${c.code} from a ${c.status} response`, async () => {
      const message = `${c.code} message`;
      mockFetch(() =>
        jsonResponse(c.status, { error: { code: c.code, message, field: c.field } }),
      );
      const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
      expect(err).toBeInstanceOf(ApiClientError);
      expect((err as ApiClientError).api).toEqual({
        kind: "http",
        status: c.status,
        error: { code: c.code, message, field: c.field },
      });
    });
  }

  it("'POST + bad JSON' is INVALID_JSON, not EMPTY_INPUT — client surfaces what server sends", async () => {
    mockFetch(() =>
      jsonResponse(400, {
        error: { code: "INVALID_JSON", message: "bad json", field: "text" },
      }),
    );
    const err = await analyzeText("garbage", { url: URL }).catch((e: unknown) => e);
    expect((err as ApiClientError).api).toMatchObject({
      kind: "http",
      status: 400,
      error: { code: "INVALID_JSON" },
    });
  });

  it("'wrong-type text' returns EMPTY_INPUT (server maps non-string to EMPTY_INPUT)", async () => {
    mockFetch(() =>
      jsonResponse(400, {
        error: { code: "EMPTY_INPUT", message: "wrong type", field: "text" },
      }),
    );
    const err = await analyzeText("", { url: URL }).catch((e: unknown) => e);
    expect((err as ApiClientError).api).toMatchObject({
      kind: "http",
      error: { code: "EMPTY_INPUT", field: "text" },
    });
  });
});

describe("analyzeText: 429 throttled", () => {
  it("returns kind: 'throttled' without parsing the body (service-generated, AWS-owned shape)", async () => {
    let bodyRead = false;
    mockFetch(() => {
      const response = new Response("AWS-throttle-text", { status: 429 });
      const original = response.text.bind(response);
      response.text = () => {
        bodyRead = true;
        return original();
      };
      return response;
    });
    const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).api).toEqual({ kind: "throttled", status: 429 });
    expect(bodyRead).toBe(false);
  });
});

describe("analyzeText: 5xx server", () => {
  it.each([500, 502, 503, 504] as const)(
    "returns kind: 'server' with status for %i",
    async (status) => {
      mockFetch(() => new Response("oops", { status }));
      const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
      expect((err as ApiClientError).api).toEqual({ kind: "server", status });
    },
  );
});

describe("analyzeText: parse failures", () => {
  it("returns kind: 'parse' for 200 with non-JSON body", async () => {
    mockFetch(
      () =>
        new Response("not json", {
          status: 200,
          headers: { "Content-Type": "text/plain" },
        }),
    );
    const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
    expect((err as ApiClientError).api).toEqual({ kind: "parse", status: 200 });
  });

  it("returns kind: 'parse' for 200 with wrong shape", async () => {
    mockFetch(() => jsonResponse(200, { foo: 1 }));
    const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
    expect((err as ApiClientError).api).toEqual({ kind: "parse", status: 200 });
  });

  it("returns kind: 'parse' for 4xx with no envelope", async () => {
    mockFetch(() => jsonResponse(400, { unexpected: "shape" }));
    const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
    expect((err as ApiClientError).api).toEqual({ kind: "parse", status: 400 });
  });
});

describe("analyzeText: network failure", () => {
  it("returns kind: 'network' when fetch rejects pre-response", async () => {
    mockFetch(() => Promise.reject(new TypeError("Failed to fetch")));
    const err = await analyzeText("x", { url: URL }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).api).toEqual({ kind: "network" });
  });
});

describe("analyzeText: timeout", () => {
  it("returns kind: 'timeout' when fetch hangs past timeoutMs", async () => {
    neverResolvingFetch();
    const err = await analyzeText("x", { url: URL, timeoutMs: 30 }).catch(
      (e: unknown) => e,
    );
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).api).toEqual({ kind: "timeout" });
  }, 1000);
});

describe("analyzeText: caller abort", () => {
  it("propagates caller-initiated abort instead of wrapping as ApiError", async () => {
    neverResolvingFetch();
    const ctrl = new AbortController();
    const promise = analyzeText("x", {
      url: URL,
      signal: ctrl.signal,
      timeoutMs: 10_000, // long, so timeout doesn't race
    });
    setTimeout(() => ctrl.abort(new Error("user cancelled")), 10);
    const err = await promise.catch((e: unknown) => e);
    expect(err).not.toBeInstanceOf(ApiClientError);
  }, 1000);
});
