import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useHistory } from "./useHistory";
import type { AnalysisView } from "@/api/toView";

const STORAGE_KEY = "sad:history:v1";
const LEGACY_KEY = "sa.history.v1";

function viewStub(text: string): AnalysisView {
  return {
    sentiment: "Positive",
    confidence: 0.9,
    emotions: [],
    keywords: [],
    inputText: text,
    analyzedAt: "2026-05-08T00:00:00Z",
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe("useHistory: empty state", () => {
  it("starts empty when localStorage is empty", () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
  });
});

describe("useHistory: add", () => {
  it("prepends a new entry with id, timestamp, inputText, result", () => {
    const { result } = renderHook(() => useHistory());
    act(() => {
      result.current.add({ inputText: "first", result: viewStub("first") });
    });
    expect(result.current.items).toHaveLength(1);
    const entry = result.current.items[0]!;
    expect(entry.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(typeof entry.timestamp).toBe("number");
    expect(entry.inputText).toBe("first");
    expect(entry.result.inputText).toBe("first");
  });

  it("orders newest first", () => {
    const { result } = renderHook(() => useHistory());
    act(() => {
      result.current.add({ inputText: "first", result: viewStub("first") });
    });
    act(() => {
      result.current.add({ inputText: "second", result: viewStub("second") });
    });
    expect(result.current.items[0]!.inputText).toBe("second");
    expect(result.current.items[1]!.inputText).toBe("first");
  });

  it("caps at 50 entries (oldest dropped on overflow)", () => {
    const { result } = renderHook(() => useHistory());
    for (let i = 0; i < 55; i++) {
      act(() => {
        result.current.add({ inputText: `entry-${i}`, result: viewStub(`entry-${i}`) });
      });
    }
    expect(result.current.items).toHaveLength(50);
    expect(result.current.items[0]!.inputText).toBe("entry-54");
    expect(result.current.items[49]!.inputText).toBe("entry-5");
  });
});

describe("useHistory: clear", () => {
  it("empties items", () => {
    const { result } = renderHook(() => useHistory());
    act(() => {
      result.current.add({ inputText: "x", result: viewStub("x") });
    });
    act(() => result.current.clear());
    expect(result.current.items).toEqual([]);
  });
});

describe("useHistory: select", () => {
  it("returns the entry for a known id", () => {
    const { result } = renderHook(() => useHistory());
    let id = "";
    act(() => {
      const e = result.current.add({ inputText: "x", result: viewStub("x") });
      id = e.id;
    });
    expect(result.current.select(id)?.inputText).toBe("x");
  });

  it("returns undefined for an unknown id", () => {
    const { result } = renderHook(() => useHistory());
    expect(result.current.select("nonexistent")).toBeUndefined();
  });
});

describe("useHistory: persistence across instances", () => {
  it("a fresh hook reads what a prior hook wrote", () => {
    const first = renderHook(() => useHistory());
    act(() => {
      first.result.current.add({ inputText: "persisted", result: viewStub("persisted") });
    });
    first.unmount();

    const second = renderHook(() => useHistory());
    expect(second.result.current.items).toHaveLength(1);
    expect(second.result.current.items[0]!.inputText).toBe("persisted");
  });
});

describe("useHistory: malformed storage recovery", () => {
  it("recovers from corrupt JSON", () => {
    localStorage.setItem(STORAGE_KEY, "not-json");
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
  });

  it("recovers from a wrong wrapper shape", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 2, entries: "wrong" }),
    );
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
  });

  it("recovers when entries contain malformed items", () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, entries: [{ id: 1 }] }),
    );
    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toEqual([]);
  });
});

describe("useHistory: legacy migration (sa.history.v1 → sad:history:v1)", () => {
  it("converts a legacy entry on first load (Title-Case → lowercase emotion key)", () => {
    const legacy = [
      {
        id: "abc",
        ts: 1700000000000,
        input: "old text",
        result: {
          sentiment: "Positive",
          confidence: 0.85,
          emotions: [
            { label: "Joy", score: 0.7 },
            { label: "Anger", score: 0.05 },
          ],
          keywords: [{ term: "great", score: 0.9 }],
        },
      },
    ];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));

    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toHaveLength(1);
    const e = result.current.items[0]!;
    expect(e.id).toBe("abc");
    expect(e.inputText).toBe("old text");
    expect(e.result.sentiment).toBe("Positive");
    expect(e.result.emotions).toHaveLength(2);
    expect(e.result.emotions[0]).toEqual({ key: "joy", label: "Joy", score: 0.7 });
    expect(e.result.keywords[0]).toEqual({
      term: "great",
      rawScore: 0.9,
      weight: 0.9,
    });
  });

  it("drops legacy entries with malformed shape or unknown sentiment", () => {
    const legacy = [
      { id: 1 }, // missing required fields entirely
      {
        id: "bad-sentiment",
        ts: 1,
        input: "x",
        result: { sentiment: "Other", confidence: 0.5, emotions: [], keywords: [] },
      },
      {
        id: "ok",
        ts: 2,
        input: "y",
        result: {
          sentiment: "Positive",
          confidence: 0.5,
          emotions: [],
          keywords: [],
        },
      },
    ];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));

    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]!.id).toBe("ok");
  });

  it("does not migrate when the new key already has data", () => {
    const legacy = [
      {
        id: "legacy",
        ts: 1,
        input: "old",
        result: {
          sentiment: "Positive",
          confidence: 0.5,
          emotions: [],
          keywords: [],
        },
      },
    ];
    const fresh = {
      version: 1,
      entries: [
        {
          id: "fresh",
          timestamp: 2,
          inputText: "new",
          result: viewStub("new"),
        },
      ],
    };
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));

    const { result } = renderHook(() => useHistory());
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]!.id).toBe("fresh");
  });

  it("leaves the legacy key in place after migration (per spec §7)", () => {
    const legacy = [
      {
        id: "abc",
        ts: 1,
        input: "x",
        result: {
          sentiment: "Positive",
          confidence: 0.5,
          emotions: [],
          keywords: [],
        },
      },
    ];
    localStorage.setItem(LEGACY_KEY, JSON.stringify(legacy));
    renderHook(() => useHistory());
    expect(localStorage.getItem(LEGACY_KEY)).not.toBeNull();
  });
});

describe("useHistory: localStorage write failure", () => {
  it("does not throw when setItem rejects (quota / private mode)", () => {
    const setItemSpy = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

    const { result } = renderHook(() => useHistory());
    expect(() => {
      act(() => {
        result.current.add({ inputText: "x", result: viewStub("x") });
      });
    }).not.toThrow();
    // In-memory state still updates even when persistence fails.
    expect(result.current.items).toHaveLength(1);

    setItemSpy.mockRestore();
  });
});
