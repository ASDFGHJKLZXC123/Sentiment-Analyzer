import {
  REQUEST_TIMEOUT_MS,
  type AnalysisResponse,
  type ServerError,
  type ServerErrorResponse,
} from "./types";

// Tagged ApiError. Every error path through analyzeText() resolves to one of these.
//   - network: fetch threw before a response (offline, DNS, connection refused)
//   - timeout: our AbortSignal.timeout fired before a response
//   - parse:   2xx body wasn't JSON / didn't match the response shape, or a 4xx
//              came back without the documented `{error:{...}}` envelope
//   - http:    4xx with a valid envelope (carries ServerError)
//   - throttled: 429 (service-generated, no envelope to parse — see phase2-backend.md)
//   - server:  5xx (no envelope guaranteed)
export type ApiError =
  | { kind: "network" }
  | { kind: "timeout" }
  | { kind: "parse"; status: number }
  | { kind: "http"; status: number; error: ServerError }
  | { kind: "throttled"; status: 429 }
  | { kind: "server"; status: number };

export class ApiClientError extends Error {
  readonly api: ApiError;
  constructor(api: ApiError, options?: ErrorOptions) {
    super(`ApiClientError(${api.kind})`, options);
    this.api = api;
    this.name = "ApiClientError";
  }
}

export interface AnalyzeOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  url?: string;
}

export async function analyzeText(
  text: string,
  opts: AnalyzeOptions = {},
): Promise<AnalysisResponse> {
  const url = opts.url ?? import.meta.env.VITE_LAMBDA_URL ?? "";
  if (!url) {
    throw new Error(
      "analyzeText: no URL — set VITE_LAMBDA_URL or pass opts.url",
    );
  }

  // Manual abort wiring instead of AbortSignal.any / AbortSignal.timeout —
  // jsdom's AbortSignal in the test env doesn't propagate AbortSignal.any
  // reliably. This is also Node 18 / older-browser portable.
  const timeoutMs = opts.timeoutMs ?? REQUEST_TIMEOUT_MS;
  const ctrl = new AbortController();
  const timeoutId = setTimeout(() => ctrl.abort(), timeoutMs);

  if (opts.signal) {
    if (opts.signal.aborted) {
      ctrl.abort();
    } else {
      const callerSignal = opts.signal;
      opts.signal.addEventListener(
        "abort",
        () => ctrl.abort(callerSignal.reason),
        { once: true },
      );
    }
  }

  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: ctrl.signal,
    });
  } catch (cause) {
    clearTimeout(timeoutId);
    // Caller wins if both fired in a race — they explicitly cancelled.
    if (opts.signal?.aborted) {
      throw cause;
    }
    if (ctrl.signal.aborted) {
      throw new ApiClientError({ kind: "timeout" }, { cause });
    }
    throw new ApiClientError({ kind: "network" }, { cause });
  }
  clearTimeout(timeoutId);

  // 429 is service-generated. Body is AWS-owned and may not match our envelope —
  // never parse it (phase2-backend.md "Reserved concurrency").
  if (response.status === 429) {
    throw new ApiClientError({ kind: "throttled", status: 429 });
  }

  // 5xx — no envelope guaranteed.
  if (response.status >= 500) {
    throw new ApiClientError({ kind: "server", status: response.status });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch (cause) {
    throw new ApiClientError(
      { kind: "parse", status: response.status },
      { cause },
    );
  }

  if (response.status >= 400) {
    if (isServerErrorResponse(body)) {
      throw new ApiClientError({
        kind: "http",
        status: response.status,
        error: body.error,
      });
    }
    throw new ApiClientError({ kind: "parse", status: response.status });
  }

  if (!isAnalysisResponse(body)) {
    throw new ApiClientError({ kind: "parse", status: response.status });
  }
  return body;
}

function isAnalysisResponse(x: unknown): x is AnalysisResponse {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.sentiment === "object" &&
    o.sentiment !== null &&
    typeof o.emotions === "object" &&
    o.emotions !== null &&
    Array.isArray(o.keywords) &&
    typeof o.inputText === "string" &&
    typeof o.analyzedAt === "string"
  );
}

function isServerErrorResponse(x: unknown): x is ServerErrorResponse {
  if (!x || typeof x !== "object") return false;
  const e = (x as { error?: unknown }).error;
  if (!e || typeof e !== "object") return false;
  const er = e as Record<string, unknown>;
  return (
    typeof er.code === "string" &&
    typeof er.message === "string" &&
    typeof er.field === "string"
  );
}
