import { useCallback, useEffect, useRef, useState } from "react";
import {
  analyzeText as defaultAnalyzeText,
  ApiClientError,
  type ApiError,
  type AnalyzeOptions,
} from "@/api/client";
import { toView, type AnalysisView } from "@/api/toView";

// Discriminated union — components consume one branch at a time, no parallel
// flag fields. `savedAt` distinguishes a re-rendered history entry from a fresh
// API result so the UI can show "Showing saved result from N min ago."
export type AnalysisState =
  | { status: "idle" }
  | { status: "loading"; startedAt: number }
  | { status: "success"; data: AnalysisView; savedAt?: number }
  | { status: "error"; error: ApiError };

export interface UseAnalysisResult {
  state: AnalysisState;
  // Milliseconds since loading started; 0 in any non-loading state.
  // Drives the 1.5s / 3s / 10s loading-tier ladder in ResultsPanel.
  elapsed: number;
  run: (text: string) => void;
  retry: () => void;
  reset: () => void;
  // Render a saved result without an API call. Used by App when the user
  // clicks a HistoryList entry.
  showSaved: (data: AnalysisView, savedAt: number) => void;
}

interface UseAnalysisOptions {
  // Override the API call for testing — defaults to the real client.
  analyze?: (text: string, opts?: AnalyzeOptions) => Promise<Parameters<typeof toView>[0]>;
}

export function useAnalysis(opts: UseAnalysisOptions = {}): UseAnalysisResult {
  const [state, setState] = useState<AnalysisState>({ status: "idle" });
  const lastInputRef = useRef<string | null>(null);
  const ctrlRef = useRef<AbortController | null>(null);
  const analyzeFn = opts.analyze ?? defaultAnalyzeText;

  // Tick to force re-renders during loading so consumers can read `elapsed`
  // and switch tiers. State update is cheap; only happens while loading.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (state.status !== "loading") return;
    const id = setInterval(() => setTick((t) => t + 1), 100);
    return () => clearInterval(id);
  }, [state.status]);

  const run = useCallback(
    (text: string) => {
      ctrlRef.current?.abort();
      const ctrl = new AbortController();
      ctrlRef.current = ctrl;
      lastInputRef.current = text;
      setState({ status: "loading", startedAt: Date.now() });

      analyzeFn(text, { signal: ctrl.signal })
        .then((response) => {
          if (ctrl.signal.aborted) return;
          setState({ status: "success", data: toView(response) });
        })
        .catch((err: unknown) => {
          if (ctrl.signal.aborted) return;
          if (err instanceof ApiClientError) {
            setState({ status: "error", error: err.api });
          } else {
            // Unexpected throw (config error, etc.). Surface as network kind
            // so the UI shows the retry banner rather than crashing.
            setState({ status: "error", error: { kind: "network" } });
          }
        });
    },
    [analyzeFn],
  );

  const retry = useCallback(() => {
    if (lastInputRef.current !== null) run(lastInputRef.current);
  }, [run]);

  const reset = useCallback(() => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    lastInputRef.current = null;
    setState({ status: "idle" });
  }, []);

  const showSaved = useCallback((data: AnalysisView, savedAt: number) => {
    ctrlRef.current?.abort();
    ctrlRef.current = null;
    setState({ status: "success", data, savedAt });
  }, []);

  useEffect(() => {
    return () => {
      ctrlRef.current?.abort();
    };
  }, []);

  const elapsed = state.status === "loading" ? Date.now() - state.startedAt : 0;

  return { state, elapsed, run, retry, reset, showSaved };
}
