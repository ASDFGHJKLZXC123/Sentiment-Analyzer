import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Conditional spread keeps `workers` absent when not on CI, instead of
  // assigning `undefined` (which exactOptionalPropertyTypes would reject).
  ...(process.env.CI ? { workers: 1 } : {}),
  reporter: "list",
  use: {
    baseURL: "http://localhost:5179",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev -- --port 5179 --strictPort",
    url: "http://localhost:5179",
    // Local: reuse a dev server if one is already running. CI: always fresh.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
    env: {
      // The client throws when this is missing; Playwright intercepts the
      // resulting fetch via page.route so the URL just needs to exist.
      VITE_LAMBDA_URL: "https://lambda.test/analyze",
    },
  },
});
