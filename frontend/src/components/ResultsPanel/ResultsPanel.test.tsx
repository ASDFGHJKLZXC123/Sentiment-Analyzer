import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResultsPanel } from "./ResultsPanel";
import type { AnalysisState } from "@/hooks/useAnalysis";
import type { AnalysisView } from "@/api/toView";

const sampleView: AnalysisView = {
  sentiment: "Positive",
  confidence: 0.83,
  emotions: [
    { key: "joy", label: "Joy", score: 0.78 },
    { key: "neutral", label: "Neutral", score: 0.1 },
    { key: "sadness", label: "Sadness", score: 0.05 },
    { key: "fear", label: "Fear", score: 0.03 },
    { key: "surprise", label: "Surprise", score: 0.02 },
    { key: "disgust", label: "Disgust", score: 0.01 },
    { key: "anger", label: "Anger", score: 0.01 },
  ],
  keywords: [
    { term: "amazing", rawScore: 0.05, weight: 1 },
    { term: "great", rawScore: 0.3, weight: 0.5 },
  ],
  inputText: "I love this — it's amazing!",
  analyzedAt: "2026-05-08T12:00:00Z",
};

function renderWithState(state: AnalysisState, elapsed = 0) {
  return render(
    <ResultsPanel state={state} elapsed={elapsed} onRetry={vi.fn()} />,
  );
}

describe("ResultsPanel: idle", () => {
  it("renders the empty placeholder", () => {
    renderWithState({ status: "idle" });
    expect(
      screen.getByRole("heading", { name: /Paste some text to get started/i }),
    ).toBeInTheDocument();
  });
});

describe("ResultsPanel: loading tier ladder (spec §7.2)", () => {
  it("tier 1 (under 1.5s): spinner only, no warming caption", () => {
    renderWithState({ status: "loading", startedAt: 0 }, 500);
    expect(screen.getByRole("status", { name: /Analyzing/i })).toBeInTheDocument();
    expect(screen.queryByText(/Warming up the model/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Still working/i)).not.toBeInTheDocument();
  });

  it("tier 2 (1.5-3s): skeleton, no caption yet", () => {
    const { container } = renderWithState({ status: "loading", startedAt: 0 }, 2000);
    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Warming up the model/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Still working/i)).not.toBeInTheDocument();
  });

  it("tier 3 (3-10s): warming caption appears", () => {
    renderWithState({ status: "loading", startedAt: 0 }, 5000);
    expect(screen.getByText(/Warming up the model/i)).toBeInTheDocument();
    expect(screen.queryByText(/Still working/i)).not.toBeInTheDocument();
  });

  it("tier 4 (10s+): 'still working' caption", () => {
    renderWithState({ status: "loading", startedAt: 0 }, 12_000);
    expect(screen.getByText(/Still working/i)).toBeInTheDocument();
    expect(screen.queryByText(/Warming up the model/i)).not.toBeInTheDocument();
  });
});

describe("ResultsPanel: success", () => {
  it("renders sentiment, emotion bars, and keyword chips", () => {
    renderWithState({ status: "success", data: sampleView });
    // Sentiment label
    expect(screen.getAllByText("Positive").length).toBeGreaterThan(0);
    // Emotion labels appear twice each — once in the bar chart, once in the
    // <details> table fallback. Just confirm both exist.
    expect(screen.getAllByText("Joy").length).toBe(2);
    expect(screen.getAllByText("Neutral").length).toBe(2);
    expect(screen.getAllByText("Anger").length).toBe(2);
    // Keywords appear once each in the chip cloud.
    expect(screen.getByText("amazing")).toBeInTheDocument();
    expect(screen.getByText("great")).toBeInTheDocument();
  });

  it("moves focus to the results heading on success transition", () => {
    renderWithState({ status: "success", data: sampleView });
    const heading = screen.getByRole("heading", { name: /Results: Positive/i });
    expect(heading).toHaveFocus();
  });

  it("savedAt renders the 'showing saved result' caption; without it, the caption is absent", () => {
    const { rerender } = render(
      <ResultsPanel
        state={{ status: "success", data: sampleView }}
        elapsed={0}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.queryByText(/Showing saved result/i)).not.toBeInTheDocument();

    rerender(
      <ResultsPanel
        state={{ status: "success", data: sampleView, savedAt: Date.now() - 60_000 }}
        elapsed={0}
        onRetry={vi.fn()}
      />,
    );
    expect(screen.getByText(/Showing saved result/i)).toBeInTheDocument();
  });
});

describe("ResultsPanel: error per ApiError kind (spec §7.4)", () => {
  it("network: shows the connection copy + retry button + receives focus", () => {
    renderWithState({ status: "error", error: { kind: "network" } });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText(/Can't reach the server/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveFocus();
  });

  it("timeout: shows cold-model copy + retry", () => {
    renderWithState({ status: "error", error: { kind: "timeout" } });
    expect(screen.getByText(/took longer than expected/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("http (4xx): shows the server-provided message and NO retry button", () => {
    renderWithState({
      status: "error",
      error: {
        kind: "http",
        status: 422,
        error: {
          code: "INPUT_TOO_LONG",
          message: "Field 'text' exceeds 5000 characters.",
          field: "text",
        },
      },
    });
    expect(screen.getByText(/Your input couldn't be analyzed/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Field 'text' exceeds 5000 characters\./i),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Try again/i })).not.toBeInTheDocument();
  });

  it("throttled (429): shows handling-lots-of-requests copy + retry", () => {
    renderWithState({ status: "error", error: { kind: "throttled", status: 429 } });
    expect(screen.getByText(/handling lots of requests/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("server (5xx): shows server-side copy + retry", () => {
    renderWithState({ status: "error", error: { kind: "server", status: 502 } });
    expect(screen.getByText(/Something went wrong on our end/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });

  it("parse: shows unexpected-response copy + retry", () => {
    renderWithState({ status: "error", error: { kind: "parse", status: 200 } });
    expect(screen.getByText(/unexpected response/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try again/i })).toBeInTheDocument();
  });
});
