import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { App } from "./App";
import { server } from "./test/server";
import { analyzeHandler, ANALYZE_URL } from "./test/handlers";

beforeEach(() => {
  localStorage.clear();
  vi.stubEnv("VITE_LAMBDA_URL", ANALYZE_URL);
});

describe("App: history persistence (regression catcher)", () => {
  it("adds exactly one history entry per successful submit", async () => {
    // Regression: an earlier App.tsx depended on the whole `history` object
    // in its add-on-success effect. Because useHistory returns a fresh object
    // each render, the effect re-fired on every render and re-added the same
    // result over and over. This test fails fast if that bug ever returns.
    server.use(analyzeHandler);
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByLabelText("Text to analyze");
    await user.type(textarea, "I love this product, it is amazing");
    await user.click(screen.getByRole("button", { name: /^Analyze$/i }));

    await waitFor(() => {
      expect(
        screen.queryByText(/Your past analyses will appear here/),
      ).not.toBeInTheDocument();
    });

    expect(screen.getAllByRole("listitem")).toHaveLength(1);

    const persisted = localStorage.getItem("sad:history:v1");
    expect(persisted).not.toBeNull();
    const parsed = JSON.parse(persisted!) as { entries: unknown[] };
    expect(parsed.entries).toHaveLength(1);
  });

  it("retry success adds one more history entry, not many", async () => {
    server.use(analyzeHandler);
    const user = userEvent.setup();
    render(<App />);

    const textarea = screen.getByLabelText("Text to analyze");
    await user.type(textarea, "I love this");
    await user.click(screen.getByRole("button", { name: /^Analyze$/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(1),
    );

    // Submit a different input — produces a new entry.
    await user.clear(textarea);
    await user.type(textarea, "I hate this");
    await user.click(screen.getByRole("button", { name: /^Analyze$/i }));

    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(2),
    );
  });
});

describe("App: history selection is id-based, not timestamp-based", () => {
  it("clicking a history row marks it aria-current='true'; submitting clears the selection", async () => {
    server.use(analyzeHandler);
    const user = userEvent.setup();
    render(<App />);

    // Submit twice to get two entries in history.
    const textarea = screen.getByLabelText("Text to analyze");
    await user.type(textarea, "I love this");
    await user.click(screen.getByRole("button", { name: /^Analyze$/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(1),
    );

    await user.clear(textarea);
    await user.type(textarea, "I hate this");
    await user.click(screen.getByRole("button", { name: /^Analyze$/i }));
    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(2),
    );

    // Click the older entry (history is newest-first, so item 1 is the first submit).
    const historyButtons = within(screen.getByRole("list")).getAllByRole(
      "button",
    );
    await user.click(historyButtons[1]!);

    expect(historyButtons[1]).toHaveAttribute("aria-current", "true");
    expect(historyButtons[0]).not.toHaveAttribute("aria-current");

    // Submit again — selection should clear.
    await user.clear(textarea);
    await user.type(textarea, "neutral observation noted");
    await user.click(screen.getByRole("button", { name: /^Analyze$/i }));

    await waitFor(() =>
      expect(screen.getAllByRole("listitem")).toHaveLength(3),
    );
    const refreshed = within(screen.getByRole("list")).getAllByRole("button");
    refreshed.forEach((btn) => {
      expect(btn).not.toHaveAttribute("aria-current", "true");
    });
  });
});

// Phase 6 §8 acceptance: pre-loaded sample chips end-to-end.
// The deterministic MSW handler labels strictly on POSITIVE_WORDS vs.
// NEGATIVE_WORDS counts plus an "!" boost. The expected labels for the
// three curated chip texts (TextInput.tsx#SAMPLE_CHIPS) are:
//   tweet     → positive (thrilled/amazing/best + 2 "!" → pos=3.6, neg=0)
//   review    → neutral  (no POSITIVE or NEGATIVE words, no "!")
//   complaint → negative (broken/useless/frustrated → neg=3, pos=0)
// If the handler's word lists or the chip texts change, update the
// expectations here — the assertion is intentionally coarse (label only,
// not probabilities) so it doesn't break on small content tweaks.
describe("App: sample chips end-to-end (§8 fixture)", () => {
  const cases = [
    { name: /Try a tweet/i, expectedLabel: "Positive" },
    { name: /Try a review/i, expectedLabel: "Neutral" },
    { name: /Try a product complaint/i, expectedLabel: "Negative" },
  ];

  for (const { name, expectedLabel } of cases) {
    it(`"${expectedLabel}" chip: click → textarea fills → submit → results render`, async () => {
      server.use(analyzeHandler);
      const user = userEvent.setup();
      render(<App />);

      const textarea = screen.getByLabelText(
        "Text to analyze",
      ) as HTMLTextAreaElement;
      expect(textarea.value).toBe("");

      await user.click(screen.getByRole("button", { name }));
      expect(textarea.value.length).toBeGreaterThan(20);

      await user.click(screen.getByRole("button", { name: /^Analyze$/i }));

      // Envelope: scope all assertions to the Results region so the
      // HistoryList's own SentimentBadge (which uses the same .sb-label
      // class) doesn't collide. Within Results, the badge label is the only
      // .sb-label, and the emotion bar that's also titled "Neutral" lives
      // in a different element class, so the assertion is unambiguous.
      await waitFor(() => {
        const results = screen.getByRole("region", { name: /^Results$/i });
        expect(
          within(results).getByText(expectedLabel, { selector: ".sb-label" }),
        ).toBeInTheDocument();
      });
      const resultsRegion = screen.getByRole("region", { name: /^Results$/i });
      expect(
        within(resultsRegion).getByRole("heading", { name: /^Emotions$/i }),
      ).toBeInTheDocument();
      expect(
        within(resultsRegion).getByRole("heading", { name: /^Keywords$/i }),
      ).toBeInTheDocument();
    });
  }
});

