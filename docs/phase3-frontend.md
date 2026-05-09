# Phase 3: Frontend Stabilization — Upgrade Low-Fi UI to React + TypeScript Dashboard

**Status:** Pending start  
**Prerequisites:** `phase-2-complete` tag, existing low-fi frontend, live Lambda Function URL available for a contract sanity check, finalized API contract in `docs/phase2-backend.md`  
**Exit criteria:** The existing low-fi frontend has been upgraded into a clean React + TypeScript dashboard with a typed API client, reusable components, complete UI states, localStorage session history, accessibility support, and frontend tests passing against mocked API responses. Phase 3 performs one lightweight live Lambda contract sanity check, but full deployed frontend/backend integration belongs to Phase 4. Tag `phase-3-complete`.

This document specifies the stabilization and upgrade of the existing low-fi dashboard UI. Phase 3 is **not** a from-scratch rebuild unless the current frontend is structurally unusable. The goal is to preserve working low-fi behavior while improving architecture, typing, state handling, visual design, accessibility, and tests.

Phase 4 covers replacing mocks with the deployed backend, validating CORS, measuring real cold-start and timeout behavior, and hardening deployed-stack edge cases. Phase 5 covers deployment and CI/CD. Anything related to production deployment belongs there, not here.

---

## 1. Goals and non-goals

### Goals

- Upgrade the existing low-fi frontend into a polished single-page dashboard for text sentiment analysis.
- Preserve any working low-fi user flow unless there is a clear reason to refactor or replace it.
- Align the frontend with the finalized Phase 2 API contract using typed request/response models.
- Render sentiment, emotion breakdown, keywords, and session history across all defined UI states.
- Establish a component architecture, state model, and visual language that can survive Phase 4-6 without major rework.
- Build a mock-first test foundation that catches frontend regressions before CI is introduced in Phase 5.
- Perform one lightweight live Lambda contract sanity check to reduce API drift risk.

### Non-goals (deferred or out of scope)

- Authentication, user accounts, multi-user history.
- Server-side persistence of history (localStorage only - see §7).
- Internationalization beyond English UI strings.
- Bulk CSV upload UI (Phase 7).
- Advanced analytics, filtering, or dashboards over historical data - history is a list, not a BI tool.
- Dark mode toggle. The visual design will use a single, cohesive palette. Reconsider in Phase 6 only if cheap.
- Full deployed frontend/backend integration. Phase 3 can sanity-check the live contract once, but Phase 4 owns real integration and hardening.

Adding any of the above mid-phase is the scope-creep failure mode. Push back to the decision log first.

---

## 2. Existing frontend audit

Before changing code, document the current low-fi frontend state in `docs/phase3-audit.md`.

Capture:

- Current framework and build tool.
- Whether TypeScript is already enabled.
- Current folder structure.
- Current components and responsibilities.
- Current API call behavior, if any.
- Current styling approach.
- Existing UI states.
- Existing localStorage/history behavior, if any.
- Existing tests, if any.
- Main problems or refactor targets.

Decision rule:

- If the current frontend is already Vite + React + TypeScript, keep it and refactor incrementally.
- If it is React but not TypeScript, migrate carefully rather than rebuilding immediately.
- If it is structurally unusable, document the reason in `decision-log.md` before replacing it.

The audit is not busywork. It prevents accidentally deleting useful low-fi behavior and makes later portfolio discussion stronger because you can explain what you improved and why.

---

## 3. Tooling and project setup

### Scaffolding / existing project handling

Do **not** scaffold a new app by default.

Use the existing low-fi frontend as the starting point. Only run `npm create vite@latest` if the audit shows the current frontend is not worth preserving.

Expected target stack:

- Vite.
- React 19.
- TypeScript strict mode.
- Node 22 LTS (matches root project decision).
- npm. No yarn or pnpm - keep tooling boring.

If migration is needed, migrate in place where possible and document the reason for any replacement in `decision-log.md`.

### Core dependencies

| Package | Purpose | Notes |
|---|---|---|
| `react`, `react-dom` | v19 | Matches project plan |
| `typescript` | Strict mode | See §4 |
| `vite` | Build + dev server | Keep if already present; migrate only if needed |
| `recharts` | Emotion chart | See §8 for chart-library decision |
| No word-cloud dependency by default | Keyword display | Use weighted keyword chips first |

### Dev dependencies

| Package | Purpose |
|---|---|
| `vitest`, `@vitest/ui` | Unit + component test runner |
| `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom` | Component testing |
| `jsdom` | DOM environment for Vitest |
| `msw` | API mocking in tests |
| `@playwright/test` | Browser smoke tests |
| `@axe-core/playwright` | Accessibility checks in Playwright |
| `eslint`, `@typescript-eslint/*`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y` | Linting including a11y rules |
| `prettier` | Formatting |

No CSS framework. Plain CSS modules or vanilla CSS with custom properties (see §8). Adding Tailwind is a scope decision that needs a decision-log entry if revisited.

### Target folder structure

Use this as the target structure after refactoring. Do not force a huge one-shot rewrite if the existing frontend can be migrated incrementally.

```text
frontend/
├── src/
│   ├── main.tsx                # Entry
│   ├── App.tsx                 # Top-level layout + state coordination
│   ├── api/
│   │   ├── client.ts           # fetch wrapper for Lambda Function URL
│   │   ├── types.ts            # Request/response types mirroring API contract
│   │   └── client.test.ts
│   ├── components/
│   │   ├── TextInput/
│   │   ├── ResultsPanel/
│   │   ├── SentimentBadge/
│   │   ├── EmotionChart/
│   │   ├── KeywordCloud/       # Implemented as weighted keyword chips in Phase 3
│   │   ├── HistoryList/
│   │   └── shared/             # Buttons, Spinner, ErrorBanner
│   ├── hooks/
│   │   ├── useAnalysis.ts      # Drives the API call + state machine
│   │   └── useHistory.ts       # localStorage-backed session log
│   ├── styles/
│   │   ├── tokens.css          # Design tokens (colors, spacing, type)
│   │   └── global.css
│   └── test/
│       ├── setup.ts            # RTL + jest-dom setup
│       └── handlers.ts         # MSW handlers
├── e2e/                        # Playwright specs
├── public/
├── index.html
├── vite.config.ts
├── tsconfig.json
└── package.json
```

The `frontend/` directory lives alongside `backend/` at the repo root. Final monorepo layout was decided in Phase 1.

---

## 4. TypeScript configuration

Strict mode on, plus:

- `"noUncheckedIndexedAccess": true` - array/object access returns `T | undefined`. Catches a real class of history-list bugs.
- `"exactOptionalPropertyTypes": true` - distinguishes `undefined` from missing.
- `"noImplicitOverride": true`.
- Path alias `@/*` -> `src/*` configured in both `tsconfig.json` and `vite.config.ts`.

API request and response types live in `src/api/types.ts` and **must match the documented backend JSON contract in `docs/phase2-backend.md` field-for-field**. If the contract changes, update `src/api/types.ts`, MSW fixtures, API client tests, and the backend contract documentation in the same PR.

---

## 5. Component architecture

### Component tree

```text
<App>
  <Header />
  <main>
    <TextInput onSubmit />
    <ResultsPanel state={analysisState}>
      <SentimentBadge />
      <EmotionChart />
      <KeywordCloud />
    </ResultsPanel>
    <HistoryList items onSelect onClear />
  </main>
  <Footer />
</App>
```

### Component responsibilities

- **`TextInput`** - controlled textarea, character counter, Submit and Clear buttons. Enforces client-side length limit (see §6). Disables Submit while a request is in flight.
- **`ResultsPanel`** - the state-machine display. Renders one of: empty placeholder, loading skeleton, success (children), error (with retry). The state-machine logic lives here so individual result components stay dumb.
- **`SentimentBadge`** - overall sentiment label + confidence. Color-coded per §8.
- **`EmotionChart`** - horizontal bar chart of emotion scores. Sorted descending by score.
- **`KeywordCloud`** - top N keywords displayed as responsive weighted chips sized by score. Do not add a true word-cloud dependency in Phase 3 unless the decision is documented.
- **`HistoryList`** - last 50 sessions from localStorage, newest first. Clicking re-renders that session in the results panel without re-calling the API.

### State management

Plain React. No Redux, no Zustand, no Context provider sprawl.

- `App` owns the current analysis state and the selected history item.
- `useAnalysis` encapsulates the request lifecycle and exposes `{ state, run, reset }`, where `state` is a discriminated union: `{ status: 'idle' } | { status: 'loading' } | { status: 'success', data } | { status: 'error', error }`.
- `useHistory` exposes `{ items, add, clear, select }` and owns localStorage behavior.
- `App` coordinates `useAnalysis` and `useHistory`. After a successful analysis, `App` calls `history.add(...)`.

`useAnalysis` should **not** directly write to history. Request lifecycle and persistence are separate concerns; keeping them separate makes both hooks easier to test and easier to change.

Discriminated unions over multiple booleans (`isLoading`, `hasError`, `data`). It's the difference between exhaustive `switch` rendering and bug-prone flag combinations.

---

## 6. API integration

Phase 3 is mock-first.

The frontend API client must be capable of calling the Lambda Function URL, but normal Phase 3 development and tests should use MSW or local mock responses. The real Lambda should only be used for one lightweight contract sanity check before tagging the phase.

Full live integration, CORS validation, cold-start timing validation, and deployed-stack error hardening belong to Phase 4.

### Client

`src/api/client.ts` exports a single `analyzeText(text: string, opts?: { signal?: AbortSignal }): Promise<AnalysisResult>`.

- Uses `fetch`. No axios - one less dependency.
- Reads the Lambda URL from `import.meta.env.VITE_LAMBDA_URL`. Local dev uses `.env.local` (gitignored); production injection happens in Phase 5.
- Sets a 30-second timeout via `AbortController`. Cold starts can take around 10 seconds; padding handles tail latency without making errors feel hung.
- Normalizes errors into a tagged `ApiError` type with `kind: 'network' | 'timeout' | 'http' | 'parse'` so the UI can render appropriately.

### Live contract sanity check

Before tagging `phase-3-complete`, run one lightweight check against the live Lambda Function URL:

- Use `curl`, a temporary local script, or one manual browser-triggered request.
- Confirm the response shape matches `src/api/types.ts` and MSW fixtures field-for-field.
- Record the result in `docs/phase3-results.md`.
- Do not make unit, component, or Playwright tests depend on the live Lambda.
- Do not tune real cold-start UX here; Phase 4 owns real timing validation.

### State handling in `useAnalysis`

- `run(text)` cancels any in-flight request via stored `AbortController`.
- On `success`, exposes the data to `App`. `App` decides whether to add it to history.
- On `error`, exposes the error and a `retry` function that re-runs with the same input.
- Cleans up on unmount.

### What the UI shows for each state

| State | UI |
|---|---|
| `idle` | Friendly empty state in `ResultsPanel` with a hint. |
| `typing` | Character counter and validation feedback while the user edits input. |
| `loading` (under 1.5s) | Subtle spinner. |
| `loading` (1.5s-10s) | Skeleton for results + a "warming up the model..." hint after 3s. The cold-start UX matters; treat it as a feature, not a bug. |
| `loading` (over 10s) | Same skeleton + "still working..." reassurance. |
| `success` | Rendered results, focus moved to results region. |
| `error` (network/timeout) | Banner with retry button. |
| `error` (http 4xx) | Banner with the server-provided message; no retry. |
| `error` (http 5xx) | Banner with retry; mention this is rare. |
| `selected history` | Previously saved result rendered without re-calling the API. |

Build these now with mocked responses. Phase 4 will validate the behavior against the deployed backend.

### Input validation

Client-side mirrors of the server limits documented in `docs/phase2-backend.md`:

- Minimum 1 non-whitespace character.
- Maximum length: whatever the Lambda accepts. Hardcoding is fine; export the constant from `api/types.ts` so it is the single source of truth on the frontend.
- Character counter turns warning color at 90% and blocks submit at 100%.

Server-side validation is still authoritative; the client check is for UX, not security.

---

## 7. History persistence

`useHistory` is backed by `localStorage` under a single key (`sad:history:v1`).

### Schema

```ts
type HistoryEntry = {
  id: string;            // crypto.randomUUID()
  timestamp: number;     // Date.now()
  inputText: string;     // Truncated preview computed at render time, full text stored
  result: AnalysisResult;
};

type HistoryStore = {
  version: 1;
  entries: HistoryEntry[];  // newest first, max 50
};
```

### Rules

- **Cap at 50 entries.** Drop oldest on overflow.
- **Cap individual `inputText` at the API max length** - already true if input passed validation.
- **Versioned key.** Future schema changes increment to `:v2` and run a one-time migration. Leaving the old key in place avoids destructive errors.
- **Wrap all reads/writes in try/catch.** localStorage can throw (quota, private mode). Failure means the feature degrades silently, not that the app crashes.
- **Clear button** prompts confirmation before wiping.
- **No PII handling beyond the obvious.** History is local to the browser; document this in the UI ("History is saved on this device only").
- **Single-entry delete is optional polish, not required for Phase 3.** Add it only if the final `HistoryList` UI feels incomplete and the implementation remains small. Otherwise defer it to Phase 6.

---

## 8. Visual design

### Design tokens (`src/styles/tokens.css`)

Single source of truth for color, spacing, type. Components reference variables, never hex values.

```css
:root {
  /* Sentiment colors - tuned for WCAG AA contrast on white bg */
  --color-positive: #2e7d32;
  --color-negative: #c62828;
  --color-neutral:  #546e7a;

  /* Emotion palette - distinct, color-blind safe */
  --color-emotion-joy:      #f9a825;
  --color-emotion-sadness:  #1565c0;
  --color-emotion-anger:    #d84315;
  --color-emotion-fear:     #6a1b9a;
  --color-emotion-surprise: #00838f;
  --color-emotion-disgust:  #558b2f;

  /* Spacing, type, radii - standard token set */
  --space-1: 4px;  --space-2: 8px;  --space-3: 16px;  --space-4: 24px;  --space-5: 40px;
  --font-sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --font-mono: ui-monospace, Menlo, monospace;
  --radius-sm: 4px; --radius-md: 8px; --radius-lg: 16px;
}
```

Run the final palette through a color-blind simulator before locking. Sentiment color is load-bearing for the UX; it has to work for everyone.

### Charts and keyword display

**Decision: Recharts for emotion chart.** Rationale: declarative, React-native API, low bundle cost for the one chart type we need in Phase 3. D3 directly is more powerful but unnecessary here. Capture the alternatives in `decision-log.md` if this is revisited.

**Decision: weighted keyword chips for Phase 3.** Use responsive keyword chips sized by score, not a true word cloud. This is easier to read, easier to test, more accessible, and avoids another visualization dependency. Revisit a true word cloud only in Phase 6 if the chip layout looks too weak for portfolio presentation.

### Layout

- Mobile-first, single column.
- Breakpoints: `--bp-md: 768px`, `--bp-lg: 1100px`.
- At `md+`, results panel sits beside the input on wide screens; history goes below or in a side rail at `lg`.
- Use CSS Grid for the top-level layout, Flexbox inside components.
- Minimum target tap area 44x44px.

### Typography

- System font stack - no web font loading. Faster, more reliable, cheaper.
- Type scale: 14 / 16 / 20 / 28 / 36px.
- Line height 1.5 for body, 1.2 for headings.

---

## 9. Accessibility

Treat a11y as a first-class requirement, not a Phase 6 polish item. Retrofitting accessibility is more painful than building it in.

### Non-negotiables

- Semantic HTML: `<main>`, `<header>`, `<section>`, `<button>` (never `<div onClick>`), proper heading hierarchy with one `<h1>`.
- All form controls have associated `<label>`s.
- `ResultsPanel` is an ARIA live region (`aria-live="polite"`) so screen readers announce new results.
- Loading and error states announce themselves to assistive tech.
- Full keyboard support: tab order is logical, focus is visible, Enter submits the form, Escape clears errors.
- Focus management: on result, move focus to the results region heading. On error, focus the error banner.
- Color is never the only signal - sentiment label has both color and text; emotion bars have labels and values, not just colored bars.
- Charts include text-based fallbacks (an accessible data table behind the visual, hidden with `.visually-hidden` for sighted users).
- Respect `prefers-reduced-motion`.

### Verification

- ESLint `jsx-a11y` plugin with the recommended rule set, errors not warnings.
- `axe-core` checks via Playwright (see §10) on key UI states.
- Manual keyboard pass before tagging `phase-3-complete`. Document the pass in the phase results doc.

---

## 10. Testing strategy

Three layers, scoped tightly. Do not test the framework; test the contracts and state behavior.

### Testing priority order

1. API client success/error behavior.
2. `useAnalysis` state-machine transitions.
3. `useHistory` localStorage behavior.
4. `ResultsPanel` rendering for every state.
5. `TextInput` validation and submit behavior.
6. One Playwright happy-path smoke test.
7. One axe accessibility scan.

Additional presentational component tests are useful but should not block the phase if the core state, API, and accessibility checks are already covered.

### Unit + component (Vitest + RTL)

Co-locate `.test.tsx` next to the file under test.

**What to test:**

- `useAnalysis`: full state-machine transitions, abort behavior, retry behavior. Mock the API client.
- `useHistory`: add, cap-at-50, clear, malformed-storage recovery, version-key handling.
- `TextInput`: validation, counter behavior, disabled-during-loading, controlled value.
- `ResultsPanel`: renders the right child for each `state.status`. One test per branch.
- `SentimentBadge`, `EmotionChart`, `KeywordCloud`: render correctly given representative data; accessible names present. Useful but lower priority than state/API tests.
- `HistoryList`: renders entries newest-first, click invokes callback, empty state, clear-with-confirm.
- API client: parses success, surfaces tagged errors for network/timeout/4xx/5xx/malformed JSON.

**What to skip:**

- Visual snapshots. They generate noise without catching real bugs at this scale.
- Testing Recharts internals.
- Testing trivial getters or pass-through props.

### API mocking

MSW with handlers in `src/test/handlers.ts`. One success fixture, one of each error class. Tests opt into specific handlers per case rather than relying on globals.

### Browser smoke tests (Playwright)

Two specs in `e2e/`:

1. **Happy path:** load app, type a phrase, submit, see results, see history entry. Run against MSW or a local mock server - not a real Lambda. Phase 4 adds a true end-to-end test.
2. **Accessibility scan:** run `@axe-core/playwright` against the empty, loading, success, and error states. Zero violations to pass.

Playwright runs locally for now; CI integration is a Phase 5 concern.

### Coverage targets

No hard percentage. The check is: every state transition in `useAnalysis` has a test, every error class in the API client has a test, every UI state in `ResultsPanel` has a test. If those are covered, total coverage will land where it lands.

---

## 11. Performance

Keep this lightweight; serious perf work is Phase 6.

- Target bundle budget: under 250 KB gzipped for the initial chunk. This is a target, not an automatic phase blocker. If exceeded, record the size and reason in `docs/phase3-results.md`.
- Recharts is the largest likely dependency. Lazy-load chart-heavy components with `React.lazy` if the bundle size is clearly caused by visualization dependencies.
- Run `vite build` and inspect the bundle once before tagging the phase. Record the number in `docs/phase3-results.md`.
- No premature memoization. Add `memo` / `useMemo` only with a measured reason.

---

## 12. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| Useful low-fi behavior is lost during refactor | Medium | Start with `docs/phase3-audit.md`; preserve working flows unless replacement is justified. |
| API contract drifts between Phase 2 doc, MSW fixtures, and actual Lambda response | Medium | Build against the doc, update fixtures with types, and run one live contract sanity check before tagging. |
| Phase 3 turns into Phase 4 integration work | Medium | Keep development/test flow mock-first; live Lambda check is sanity only. |
| Cold start UX feels broken to users | High | Build the 1.5s / 3s / 10s loading-state ladder now; Phase 4 verifies with real timings. |
| Recharts bundle bloats first paint | Medium | Lazy-load if budget is clearly exceeded due to charts. Decision is reversible. |
| localStorage corruption from a prior schema | Low | Versioned key + try/catch around all reads. |
| Color choices look fine to me but fail color-blind users | Medium | Run palette through simulator before locking tokens. |
| "Just one more component" scope creep | High | Section 1 non-goals. Decision-log entry required to add scope. |

---

## 13. Acceptance checklist

Before tagging `phase-3-complete`, every item below is true:

- [ ] Existing low-fi frontend audited and summarized in `docs/phase3-audit.md`.
- [ ] Decision made to preserve, migrate, or replace the existing frontend; any replacement is justified in `decision-log.md`.
- [ ] App runs locally with `npm run dev`.
- [ ] TypeScript strict mode is enabled and `tsc --noEmit` is clean.
- [ ] API request/response types match the Phase 2 backend contract field-for-field.
- [ ] API client supports `VITE_LAMBDA_URL` but frontend tests use mocks.
- [ ] One lightweight live Lambda contract sanity check completed and recorded in `docs/phase3-results.md`.
- [ ] All required UI states render correctly with mocked API responses: idle, typing, loading, success, error, retry-after-error, selected history.
- [ ] `useAnalysis` request lifecycle is tested.
- [ ] `useHistory` localStorage behavior is tested.
- [ ] API client success and error classes are tested.
- [ ] `ResultsPanel` state rendering tests pass.
- [ ] Playwright happy-path smoke test passes against mock data.
- [ ] axe accessibility scan passes for key UI states.
- [ ] `eslint .` is clean, including jsx-a11y rules.
- [ ] Manual keyboard pass completed and noted.
- [ ] Bundle size measured and recorded in `docs/phase3-results.md`.
- [ ] `decision-log.md` updated for any deviations from this spec.
- [ ] Tagged `phase-3-complete`.

---

## 14. Hand-off to Phase 4

Phase 4 inherits a stabilized frontend that works fully against mocked responses and has completed one lightweight live Lambda contract sanity check.

Phase 4 is responsible for:

- Replacing mock usage with the real deployed Lambda Function URL.
- Validating CORS in the browser.
- Measuring real cold-start and warm-path behavior.
- Testing timeout, 4xx, 5xx, malformed response, and network failure paths against the deployed system.
- Adjusting frontend copy and retry behavior based on real backend behavior.
- Producing a working live demo candidate.

If Phase 3 leaves Phase 4 with clean state management, typed API boundaries, and tested UI states, Phase 4 becomes integration verification instead of frontend rework.
