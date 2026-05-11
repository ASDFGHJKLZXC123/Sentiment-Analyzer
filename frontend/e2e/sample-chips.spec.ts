import { test, expect } from "@playwright/test";
import { ANALYZE_URL, fulfillSuccess } from "./fixtures";

test.describe("sample chips", () => {
  test("click chip → textarea fills → submit → results panel renders", async ({
    page,
  }) => {
    await page.route(ANALYZE_URL, fulfillSuccess);
    await page.goto("/");

    const textarea = page.getByLabel("Text to analyze");
    await expect(textarea).toHaveValue("");

    // Sample chips group is only visible when the textarea is empty.
    const samplesGroup = page.getByRole("group", { name: /Sample inputs/i });
    await expect(samplesGroup).toBeVisible();

    // Click the first chip — the "Try a tweet" one — and assert the textarea
    // populates with the canned sample text (TextInput.tsx#SAMPLE_CHIPS).
    await page.getByRole("button", { name: /Try a tweet/i }).click();
    await expect(textarea).not.toHaveValue("");
    await expect(textarea).toHaveValue(/headphones/);

    // Once the textarea has content, the samples group hides per the
    // existing component logic.
    await expect(samplesGroup).toBeHidden();

    // Submit — the fulfillSuccess fixture always returns the positive shape,
    // so the rendered sentiment badge reads "Positive" regardless of the
    // chip text. Assertion is intentionally about the results envelope
    // shape (sentiment + emotion + keyword chips all rendered), not the
    // categorical label — that's covered by the vitest fixture suite.
    await page.getByRole("button", { name: /^Analyze$/i }).click();
    await expect(page.getByText("Positive").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Emotions$/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /^Keywords$/i }),
    ).toBeVisible();
  });
});
