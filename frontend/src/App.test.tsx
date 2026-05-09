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

