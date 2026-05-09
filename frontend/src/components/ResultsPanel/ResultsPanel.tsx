import { useEffect, useRef, type RefObject } from "react";
import type { ApiError } from "@/api/client";
import type { AnalysisView } from "@/api/toView";
import type { AnalysisState } from "@/hooks/useAnalysis";
import { SentimentBadge } from "@/components/SentimentBadge/SentimentBadge";
import { EmotionChart } from "@/components/EmotionChart/EmotionChart";
import { KeywordCloud } from "@/components/KeywordCloud/KeywordCloud";
import { Spinner } from "@/components/shared/Spinner/Spinner";
import {
  SkeletonBadge,
  SkeletonChart,
  SkeletonKeywords,
} from "@/components/shared/Skeleton/Skeleton";
import { relativeTime } from "@/utils/relativeTime";

interface Props {
  state: AnalysisState;
  elapsed: number;
  onRetry: () => void;
}

export function ResultsPanel({ state, elapsed, onRetry }: Props) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (state.status === "success") {
      headingRef.current?.focus();
    }
  }, [state]);

  return (
    <section className="region-results" aria-labelledby="results-section-heading">
      <div className="card card-lg">
        <div className="card-inner">
          <h2 id="results-section-heading" className="section-heading">
            Results
          </h2>
          <div aria-live="polite" aria-atomic="false">
            {state.status === "idle" && <EmptyState />}
            {state.status === "loading" && <LoadingState elapsed={elapsed} />}
            {state.status === "error" && (
              <ErrorBanner error={state.error} onRetry={onRetry} />
            )}
            {state.status === "success" && (
              <SuccessContent
                data={state.data}
                savedAt={state.savedAt}
                headingRef={headingRef}
              />
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

function EmptyState() {
  return (
    <div className="results-empty">
      <svg className="icon" viewBox="0 0 64 64" fill="none" aria-hidden="true">
        <rect
          x="8"
          y="14"
          width="48"
          height="36"
          rx="4"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <path
          d="M16 26h32M16 34h24M16 42h18"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
      </svg>
      <h2>Paste some text to get started.</h2>
      <p>We&apos;ll analyze sentiment, detect emotions, and pull out keywords.</p>
    </div>
  );
}

function LoadingState({ elapsed }: { elapsed: number }) {
  if (elapsed < 1500) {
    return <Spinner label="Analyzing" />;
  }
  const tier3 = elapsed >= 3000 && elapsed < 10000;
  const tier4 = elapsed >= 10000;
  return (
    <div>
      <div className="result-stack" aria-busy="true">
        <SkeletonBadge />
        <SkeletonChart />
        <SkeletonKeywords />
      </div>
      {(tier3 || tier4) && (
        <div className="loading-caption" aria-live="polite">
          <div className="spinner" aria-hidden="true" />
          <span>
            {tier4
              ? "Still working… almost there."
              : "Warming up the model — this happens on the first request."}
          </span>
        </div>
      )}
    </div>
  );
}

interface ErrorMeta {
  title: string;
  body: (error: ApiError) => string;
  retry: boolean;
}

const ERROR_COPY: Record<ApiError["kind"], ErrorMeta> = {
  network: {
    title: "Can't reach the server.",
    body: () => "Check your connection and try again.",
    retry: true,
  },
  timeout: {
    title: "That took longer than expected.",
    body: () => "The model may be cold — try again.",
    retry: true,
  },
  http: {
    title: "Your input couldn't be analyzed.",
    body: (e) => (e.kind === "http" ? e.error.message : "Please edit your input and try again."),
    retry: false,
  },
  throttled: {
    title: "We're handling lots of requests right now.",
    body: () => "Please wait a moment and try again.",
    retry: true,
  },
  server: {
    title: "Something went wrong on our end.",
    body: () => "This is rare — please try again.",
    retry: true,
  },
  parse: {
    title: "We received an unexpected response.",
    body: () => "Please try again.",
    retry: true,
  },
};

function ErrorBanner({ error, onRetry }: { error: ApiError; onRetry: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const meta = ERROR_COPY[error.kind];
  return (
    <div className="error-banner" role="alert" tabIndex={-1} ref={ref}>
      <div className="eb-head">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.6" />
          <path d="M8 4.5V9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <circle cx="8" cy="11.4" r="0.9" fill="currentColor" />
        </svg>
        <span>{meta.title}</span>
      </div>
      <p>{meta.body(error)}</p>
      {meta.retry && (
        <div className="eb-actions">
          <button type="button" className="btn-retry" onClick={onRetry}>
            Try again
          </button>
        </div>
      )}
    </div>
  );
}

interface SuccessContentProps {
  data: AnalysisView;
  // `number | undefined` (rather than `savedAt?: number`) so callers with
  // exactOptionalPropertyTypes can pass through a possibly-undefined source.
  savedAt: number | undefined;
  headingRef: RefObject<HTMLHeadingElement | null>;
}

function SuccessContent({ data, savedAt, headingRef }: SuccessContentProps) {
  return (
    <div className="result-stack">
      <h2 id="results-heading" className="sr-only" tabIndex={-1} ref={headingRef}>
        Results: {data.sentiment}, {Math.round(data.confidence * 100)} percent confidence
      </h2>
      {savedAt !== undefined && (
        <div className="saved-caption" aria-live="off">
          Showing saved result from {relativeTime(savedAt)}.
        </div>
      )}
      <div>
        <h3 className="result-block-label">Sentiment</h3>
        <SentimentBadge sentiment={data.sentiment} confidence={data.confidence} />
      </div>
      <EmotionChart emotions={data.emotions} />
      <KeywordCloud keywords={data.keywords} />
    </div>
  );
}
