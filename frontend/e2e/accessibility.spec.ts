import AxeBuilder from "@axe-core/playwright";
import { test, expect } from "@playwright/test";
import { ANALYZE_URL, fulfillSuccess } from "./fixtures";

test.describe("accessibility (axe scan)", () => {
  test("idle (empty) state has zero violations", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("heading", { name: /Paste some text to get started/i }),
    ).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("loading (skeleton tier) state has zero violations", async ({ page }) => {
    // Hold the response open so the page sits in the skeleton tier while axe runs.
    let release: (() => void) | undefined;
    const held = new Promise<void>((r) => {
      release = r;
    });
    await page.route(ANALYZE_URL, async (route) => {
      await held;
      await fulfillSuccess(route);
    });

    await page.goto("/");
    await page.getByLabel("Text to analyze").fill("hold this open");
    await page.getByRole("button", { name: /^Analyze$/i }).click();

    // Wait until we're past tier 1 (spinner) into the skeleton tier.
    await expect(page.locator('[aria-busy="true"]')).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);

    release?.();
  });

  test("success state has zero violations", async ({ page }) => {
    await page.route(ANALYZE_URL, fulfillSuccess);
    await page.goto("/");
    await page.getByLabel("Text to analyze").fill("I love this — amazing!");
    await page.getByRole("button", { name: /^Analyze$/i }).click();
    await expect(page.getByText("Positive").first()).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });

  test("error state has zero violations", async ({ page }) => {
    await page.route(ANALYZE_URL, async (route) => {
      await route.fulfill({
        status: 502,
        contentType: "text/plain",
        body: "Bad Gateway",
      });
    });
    await page.goto("/");
    await page.getByLabel("Text to analyze").fill("anything");
    await page.getByRole("button", { name: /^Analyze$/i }).click();
    await expect(page.getByRole("alert")).toBeVisible();

    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
  });
});
