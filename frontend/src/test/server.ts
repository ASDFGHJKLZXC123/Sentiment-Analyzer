import { setupServer } from "msw/node";

// No global default handlers — tests opt in via server.use(...) per spec §10.
// onUnhandledRequest is set in setup.ts so any request to an unhandled URL
// fails loudly instead of falling through to the real network.
export const server = setupServer();
