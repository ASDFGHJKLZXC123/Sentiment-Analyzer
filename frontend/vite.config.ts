/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  // GitHub Pages serves the bundle at /Sentiment-Analyzer/ (case-exact match
  // to the repo slug per `git remote -v`). Without this, asset URLs resolve
  // to /assets/* and 404 on the deployed origin. Dev (`npm run dev`) still
  // serves under /Sentiment-Analyzer/ but the Vite proxy at /api/analyze is
  // absolute-pathed so it remains unaffected.
  base: "/Sentiment-Analyzer/",
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    // Per phase2-backend.md §"Function URL & CORS": the Lambda's CORS allowlist
    // only includes the GitHub Pages origin, not localhost. In dev, route the
    // browser's POST to a same-origin path (`/api/analyze`) and let Vite proxy
    // forward server-to-server. Set `VITE_LAMBDA_URL=/api/analyze` for dev.
    proxy: {
      "/api/analyze": {
        target: "https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/analyze/, "/"),
      },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["src/test/setup.ts"],
    css: false,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    // Integration tests in App.test.tsx do full submit cycles through MSW +
    // useAnalysis state machine + render. Phase 6 §8 added three more such
    // tests for the sample-chips fixture, pushing the file's total runtime
    // near the default 5s per-test timeout under jsdom. 10s gives headroom.
    testTimeout: 10_000,
  },
});
