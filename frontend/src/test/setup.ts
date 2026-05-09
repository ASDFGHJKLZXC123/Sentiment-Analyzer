import "@testing-library/jest-dom/vitest";
import { afterAll, afterEach, beforeAll } from "vitest";
import { cleanup } from "@testing-library/react";
import { server } from "./server";

// MSW node server runs for the entire test suite. Per spec §10, no default
// handlers — tests opt in via `server.use(...)`. Unhandled requests error
// (loud failure) so a forgotten handler doesn't silently hit the real network.
beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
  cleanup();
  server.resetHandlers();
});
afterAll(() => server.close());
