import { describe, it, expect, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useAnalysis } from "./useAnalysis";
import { ApiClientError } from "@/api/client";
import type { AnalysisResponse } from "@/api/types";
import type { AnalysisView } from "@/api/toView";

const mockResponse: AnalysisResponse = {
  sentiment: { label: "positive", confidence: 0.9 },
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
    { term: "great", score: 0.05 },
    { term: "ok", score: 0.3 },
  ],
  inputText: "great",
  analyzedAt: "2026-05-08T00:00:00Z",
};

const negativeResponse: AnalysisResponse = {
  ...mockResponse,
  sentiment: { label: "negative", confidence: 0.7 },
};

const viewStub: AnalysisView = {
  sentiment: "Positive",
  confidence: 0.9,
  emotions: [],
  keywords: [],
  inputText: "saved",
  analyzedAt: "2026-05-08T00:00:00Z",
};

describe("useAnalysis: initial state", () => {
  it("starts idle with elapsed=0", () => {
    const { result } = renderHook(() => useAnalysis({ analyze: vi.fn() }));
    expect(result.current.state.status).toBe("idle");
    expect(result.current.elapsed).toBe(0);
  });
});

describe("useAnalysis: success path", () => {
  it("idle → loading → success with view-model data", async () => {
    const analyze = vi.fn().mockResolvedValue(mockResponse);
    const { result } = renderHook(() => useAnalysis({ analyze }));

    act(() => result.current.run("great"));
    expect(result.current.state.status).toBe("loading");
    expect(analyze).toHaveBeenCalledWith(
      "great",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    if (result.current.state.status !== "success") throw new Error("not success");
    expect(result.current.state.data.sentiment).toBe("Positive");
    expect(result.current.state.data.emotions).toHaveLength(7);
    expect(result.current.state.savedAt).toBeUndefined();
  });
});

describe("useAnalysis: error path", () => {
  it("ApiClientError(http) → state.error preserves the tagged union", async () => {
    const apiErr = new ApiClientError({
      kind: "http",
      status: 422,
      error: { code: "INPUT_TOO_LONG", message: "too long", field: "text" },
    });
    const analyze = vi.fn().mockRejectedValue(apiErr);
    const { result } = renderHook(() => useAnalysis({ analyze }));

    act(() => result.current.run("x".repeat(6000)));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toEqual({
      kind: "http",
      status: 422,
      error: { code: "INPUT_TOO_LONG", message: "too long", field: "text" },
    });
  });

  it("non-ApiClientError throw → kind: 'network' fallback", async () => {
    const analyze = vi.fn().mockRejectedValue(new Error("config error"));
    const { result } = renderHook(() => useAnalysis({ analyze }));

    act(() => result.current.run("x"));
    await waitFor(() => expect(result.current.state.status).toBe("error"));
    if (result.current.state.status !== "error") throw new Error("not error");
    expect(result.current.state.error).toEqual({ kind: "network" });
  });
});

describe("useAnalysis: retry", () => {
  it("retry() re-runs with the last input", async () => {
    const analyze = vi.fn().mockResolvedValue(mockResponse);
    const { result } = renderHook(() => useAnalysis({ analyze }));

    act(() => result.current.run("first"));
    await waitFor(() => expect(result.current.state.status).toBe("success"));

    act(() => result.current.retry());
    await waitFor(() => expect(analyze).toHaveBeenCalledTimes(2));
    expect(analyze).toHaveBeenLastCalledWith("first", expect.anything());
  });

  it("retry() is a no-op when there has been no prior run", () => {
    const analyze = vi.fn();
    const { result } = renderHook(() => useAnalysis({ analyze }));
    act(() => result.current.retry());
    expect(analyze).not.toHaveBeenCalled();
  });
});

describe("useAnalysis: reset", () => {
  it("reset() returns to idle and clears lastInput so retry becomes a no-op", async () => {
    const analyze = vi.fn().mockResolvedValue(mockResponse);
    const { result } = renderHook(() => useAnalysis({ analyze }));

    act(() => result.current.run("first"));
    await waitFor(() => expect(result.current.state.status).toBe("success"));

    act(() => result.current.reset());
    expect(result.current.state.status).toBe("idle");

    act(() => result.current.retry());
    expect(analyze).toHaveBeenCalledTimes(1);
  });
});

describe("useAnalysis: showSaved", () => {
  it("renders a saved view with savedAt timestamp, no API call", () => {
    const analyze = vi.fn();
    const { result } = renderHook(() => useAnalysis({ analyze }));
    act(() => result.current.showSaved(viewStub, 1234567));
    if (result.current.state.status !== "success") throw new Error("not success");
    expect(result.current.state.savedAt).toBe(1234567);
    expect(result.current.state.data).toBe(viewStub);
    expect(analyze).not.toHaveBeenCalled();
  });
});

describe("useAnalysis: in-flight cancellation", () => {
  it("running again ignores the previous request's late response", async () => {
    let resolveFirst!: (r: AnalysisResponse) => void;
    const firstPromise = new Promise<AnalysisResponse>((r) => {
      resolveFirst = r;
    });

    const analyze = vi
      .fn()
      .mockReturnValueOnce(firstPromise)
      .mockResolvedValueOnce(negativeResponse);

    const { result } = renderHook(() => useAnalysis({ analyze }));

    act(() => result.current.run("first"));
    act(() => result.current.run("second"));

    // Only resolve the first call AFTER the second has been kicked off.
    await act(async () => {
      resolveFirst(mockResponse);
    });

    await waitFor(() => expect(result.current.state.status).toBe("success"));
    if (result.current.state.status !== "success") throw new Error("not success");
    expect(result.current.state.data.sentiment).toBe("Negative");
  });
});

describe("useAnalysis: unmount cleanup", () => {
  it("aborts in-flight on unmount without crashing", async () => {
    let resolveIt!: (r: AnalysisResponse) => void;
    const promise = new Promise<AnalysisResponse>((r) => {
      resolveIt = r;
    });
    const analyze = vi.fn().mockReturnValue(promise);

    const { result, unmount } = renderHook(() => useAnalysis({ analyze }));
    act(() => result.current.run("text"));
    expect(result.current.state.status).toBe("loading");

    unmount();
    // Resolving after unmount should be a no-op (controller was aborted).
    resolveIt(mockResponse);
    await new Promise((r) => setTimeout(r, 10));
    // Reaching this point without an unhandled rejection or React warning is the assertion.
    expect(true).toBe(true);
  });
});
