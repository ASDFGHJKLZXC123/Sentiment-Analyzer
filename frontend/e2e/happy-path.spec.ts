import { test, expect } from "@playwright/test";
import { ANALYZE_URL, fulfillSuccess } from "./fixtures";

test.describe("happy path", () => {
  test("type → submit → see results → see history entry", async ({ page }) => {
    await page.route(ANALYZE_URL, fulfillSuccess);
    await page.goto("/");

    // idle empty state
    await expect(
      page.getByRole("heading", { name: /Paste some text to get started/i }),
    ).toBeVisible();

    // type and submit
    await page
      .getByLabel("Text to analyze")
      .fill("I love this product, it is absolutely amazing!");
    await page.getByRole("button", { name: /^Analyze$/i }).click();

    // results appear: sentiment label + emotion bars + keyword chips
    await expect(page.getByText("Positive").first()).toBeVisible();
    await expect(page.getByText("Joy").first()).toBeVisible();
    // Scope to the keyword cloud — "amazing" also appears in the textarea and
    // history preview, so an unscoped getByText would be ambiguous.
    await expect(page.locator(".kw-cloud").getByText("amazing")).toBeVisible();

    // history entry appears (newest-first list, single item)
    await expect(page.getByRole("listitem")).toHaveCount(1);
  });
});
