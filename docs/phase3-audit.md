# Phase 3 Frontend Audit

Audit of the existing low-fi frontend in `frontend/`, completed before any Phase 3 changes. Decision is in §11.

## 1. Current frontend summary

- Framework: React 18.3.1 from UMD CDN (`react.development.js` and `react-dom.development.js` from unpkg)
- Build tool: None — Babel Standalone 7.29.0 transpiles JSX in the browser at load time
- Language mode: JavaScript with JSX. No TypeScript; files are `.jsx`
- Package manager: None — no `package.json` or lockfile in `frontend/`
- Current entry point: `frontend/Sentiment Analyzer.html` (loads scripts in this order: `useAnalysis.jsx` → `Atoms.jsx` → `TextInput.jsx` → `ResultsPanel.jsx` → `HistoryList.jsx` → `App.jsx`)
- Current run command: open the HTML file directly in a browser, or serve `frontend/` with any static server. No build step.

## 2. Existing folder structure

```text
frontend/
├── Sentiment Analyzer.html        # Entry; loads UMD React + Babel + 6 scripts
├── src/
│   ├── App.jsx                    # Root component; owns text + tweaks state
│   ├── components/
│   │   ├── Atoms.jsx              # SentimentBadge, EmotionChart, KeywordCloud, skeletons, Spinner (bundled)
│   │   ├── HistoryList.jsx        # HistoryList + SentimentBadgeMini + ConfirmDialog
│   │   ├── ResultsPanel.jsx       # State-machine wrapper + Empty/Loading/Error/Success children
│   │   └── TextInput.jsx          # Textarea + counter + sample chips + buttons
│   ├── hooks/
│   │   └── useAnalysis.jsx        # Hook + in-process mock analyzer + history persistence (mixed concerns)
│   └── styles/
│       ├── tokens.css             # Design tokens — matches spec hex values
│       └── app.css                # Component layout + responsive grid (768/1100 breakpoints)
└── uploads/
    └── phase3-ui-ux.md            # Stray copy of the UX spec — looks like an artifact, not part of frontend
```

Missing entirely: `package.json`, `tsconfig.json`, `vite.config.ts`, repo-root `index.html`, `src/main.tsx`, `src/api/`, `src/test/`, `e2e/`. No tests, ESLint, or Prettier configuration.

Components export by attaching to `window` (e.g., `window.TextInput = TextInput`) since there is no module system.

## 3. Existing user flow

1. User opens HTML page; sees header, empty input region with three sample chips, empty results panel ("Paste some text to get started"), empty history list.
2. User types into the textarea, picks a sample chip, or pastes text. Counter ticks; warns at 90% of 2000 chars, blocks at 100%.
3. User clicks **Analyze** (or Cmd/Ctrl+Enter). Spinner appears; after 1.5s a skeleton; after 3s a "warming up the model" caption; after 10s "still working…".
4. After ~700ms (warm) or ~5s (simulated cold first request per tab), result renders with sentiment badge, emotion bars, and keyword chips. Focus moves to results heading; new entry is added to top of history with a 220ms highlight.
5. Clicking a history item re-renders that entry without a fresh analysis; a "Showing saved result from N min ago" caption appears.
6. **Clear** wipes the textarea and resets results to empty. **Clear** in history opens a confirm dialog before wiping localStorage.
7. A debug Tweaks panel can be opened via an external `__activate_edit_mode` postMessage; it lets the developer force latency tier or error class.

Working behavior to preserve:

- Three-tier loading ladder (1.5s / 3s / 10s thresholds) — copy and timing match the UX spec
- Error copy and retry policy per error class (network / timeout / 4xx / 5xx)
- Sample chips (tweet / review / complaint) that fill the textarea and focus Submit
- Cmd/Ctrl+Enter submit and Esc clear keyboard shortcuts
- 50-entry history cap with newest-first ordering
- Confirm-before-clear dialog with focus management
- Saved-result caption when re-rendering a history entry
- 220ms history insertion highlight (animation suppressed under `prefers-reduced-motion`)
- Focus moves to error banner on error and to results heading on success
- `aria-live="polite"` on results region, `role="alert"` on error banner
- "Show as table" `<details>` fallback for emotion chart
- Sentiment icon (✓ / ✗ / ‒) so the badge reads without color
- `font-variant-numeric: tabular-nums` on percentages

Confusing or broken behavior to change:

- "Analysis" never leaves the browser — it is a deterministic mock. Useful as a UI prototype, not as a Phase 3 deliverable. The footer copy at `App.jsx:112` ("Text you analyze is sent to a serverless function and not stored") is therefore *currently false*. Hedge during the migration window or only render that line once the real client is wired up.
- Tweaks panel ships with the production app behind a postMessage hook. Either gate it behind `import.meta.env.DEV` or remove from production bundle.
- Component bundling: `Atoms.jsx` mixes 5 distinct components.
- Globals on `window` make components impossible to test in isolation.
- History schema (`ts` / `input`, bare array) drifts from spec (`timestamp` / `inputText`, versioned wrapper).
- Storage key is `sa.history.v1`, not `sad:history:v1` per spec §7.
- ID uses `${Date.now()}-${random}`, not `crypto.randomUUID()`.
- `KeywordCloud` discards `score` from the rendered output: chip size is decided purely by array index (`Atoms.jsx:106`, `i < 3 ? lg : i < 7 ? base : sm`), not by `score`. Spec §6.4 wants size driven by score, and the YAKE inversion in §5.1 only matters once score-based sizing exists.

## 4. Current components

| Component/file | Current responsibility | Keep/refactor/replace | Notes |
|---|---|---|---|
| `App.jsx` | Layout, state coordination, Tweaks panel + postMessage protocol | Refactor | Move Tweaks panel out of production; convert to `.tsx`; coordinate `useHistory` separately from `useAnalysis` |
| `TweaksPanel` (App.jsx:132-194) | Debug-only latency/error injection | Replace or gate | Doesn't belong in production bundle; either dev-only via `import.meta.env.DEV` or remove and rely on MSW |
| `useAnalysis.jsx` | Hook + mock analyzer + history persistence (mixed) | Refactor (split) | Spec §5 forbids history writes from `useAnalysis`; extract `useHistory`; replace mock with real `analyzeText` client |
| `mockAnalyze` (useAnalysis.jsx:12-88) | Deterministic in-process sentiment/emotion/keyword stub | Move | Becomes an MSW success fixture in `src/test/handlers.ts` |
| `Atoms.jsx` | SentimentBadge, EmotionChart, KeywordCloud, SkeletonBadge, SkeletonChart, SkeletonKeywords, Spinner — plus helpers `SentimentIcon` and `EMOTION_COLORS` map | Refactor (split) | One component per folder per spec §3. `SentimentIcon` lives with `SentimentBadge/` (re-used by `SentimentBadgeMini` in `HistoryList`); `EMOTION_COLORS` moves into `EmotionChart/`. **`KeywordCloud` currently sizes chips by array index, not `score`** (`Atoms.jsx:106`). Implement score-based sizing during the port and apply YAKE inversion (see §5.1). |
| `TextInput.jsx` | Textarea, counter, sample chips, submit/clear buttons, keyboard shortcuts | Keep | Port to `.tsx` cleanly; no behavioral changes needed |
| `ResultsPanel.jsx` | State-machine wrapper + EmptyState, LoadingState, ErrorBanner, SuccessContent | Keep | Port to `.tsx`; consume discriminated-union state from `useAnalysis` |
| `HistoryList.jsx` | Item list, time tick, ConfirmDialog, SentimentBadgeMini | Refactor | Extract `ConfirmDialog` to `components/shared/`; consume `useHistory` from `App`; rename schema fields |
| `tokens.css` | CSS custom properties (color/space/type/radii/motion) | Keep | Already matches spec hex-for-hex |
| `app.css` | Component layout + responsive grid (1fr / 1fr 1fr / 1fr 1.5fr 1fr) | Keep | Inline styles in a few JSX files (TweaksPanel, SentimentBadgeMini) should move here |

## 5. Current API behavior

- Does the frontend call an API today? No. `runAnalysis` calls `setTimeout(mockAnalyze)` in-process (useAnalysis.jsx:148-197).
- Endpoint or env var used: None. No `VITE_LAMBDA_URL`, no `fetch`, no `import.meta.env`.
- Request shape: N/A — input is a JS string passed to `mockAnalyze(text)`.
- Loading handling: simulated cold-start delay via `fakeRequestDelay` (useAnalysis.jsx:92-103) using `sessionStorage` to track first-request-per-tab. The 4-tier UI ladder (spinner / skeleton / warming / still working) is driven by an `elapsed` counter that ticks while `status === 'loading'`.
- Error handling: simulated only. The Tweaks panel injects `network`, `timeout`, `4xx`, `5xx` cases; `useAnalysis` translates these into `error.kind` strings the UI already recognizes. No real `ApiError` tagged union, no `AbortController`, no timeout, no parse-error handling.

### 5.1 Contract verification (vs `docs/phase2-backend.md`)

Verified 2026-05-07. The mock's shape **does not match** the deployed backend contract. Drift table:

| Field | Backend (truth, `phase2-backend.md` §API contract) | Current mock (`mockAnalyze`) | Drift |
|---|---|---|---|
| Sentiment label | `sentiment.label` — lowercase `"positive" \| "negative" \| "neutral"` | `sentiment` top-level — Title Case `"Positive" \| "Negative" \| "Neutral"` | Major. Different nesting **and** different case. |
| Sentiment confidence | `sentiment.confidence` (number) | `confidence` top-level | Major. Flat vs nested. |
| Emotions shape | **Object** keyed by emotion: `{anger, disgust, fear, joy, neutral, sadness, surprise}` → number | **Array** of `{label, score}` (6 items) | Major. Object vs array. |
| Emotion labels | lowercase keys (`anger`, `joy`…) | Title Case (`"Anger"`, `"Joy"`) | Case mismatch. |
| Emotion list | 7 emotions; **includes `neutral`** | 6 emotions; **no `neutral`** | Mock is missing a category. |
| Keywords outer shape | `[{term, score}]` — `term` can be a multi-word phrase (e.g., `"Amazing experience"`) | `[{term, score}]` — `term` is always a lowercase single token from a regex split (`useAnalysis.jsx:14, 74-78`) | Outer shape matches; **`term` granularity differs.** Mock won't exercise multi-word keywords until the reshape lands. |
| Keyword `score` semantics | **Raw YAKE — lower is more relevant.** Frontend "inverts/normalizes for visual sizing." | **Normalized 0-1, higher is more relevant** (`useAnalysis.jsx:81-85`) | **Inverted.** A naive port that sizes by raw backend `score` would size the *worst* keywords largest. (Today's chip sizing ignores `score` entirely — see §3.) |
| `inputText` (server-echoed, ≤200 chars) | Present | Missing | Missing field. |
| `analyzedAt` (ISO 8601 UTC) | Present | Missing | Missing field. |
| Error envelope | `{error: {code, message, field}}` — `field` is **always emitted** (`backend/lambda_function.py:57-63`) with `code ∈ {EMPTY_INPUT, INPUT_TOO_LONG, INVALID_JSON, METHOD_NOT_ALLOWED}` and `field ∈ {text, method}` | UI consumes `kind ∈ {network, timeout, 4xx, 5xx}` | Two different error vocabularies. |
| Throttling | Service-generated `429` outside the handler envelope (reserved-concurrency exhaustion) | Not represented | Missing `THROTTLED` state. |
| Client-side length cap | Server enforces 5000 chars (`INPUT_TOO_LONG` at 5001) | Client caps at 2000 (`MAX_LEN`) | Client mirror is too tight. |

Implications for the migration:

- **`src/api/types.ts` mirrors the backend, not the mock.** Spec §4 requires field-for-field match with `phase2-backend.md`. Source of truth is the backend.
- **A thin adapter is the cleanest path.** Define `AnalysisResponse` matching the backend, plus `AnalysisView` (or rename existing display shape) that components consume. Adapter lives in `api/` (e.g., `toView(response): AnalysisView`) and does: lowercase → Title-Case sentiment label, object emotions → sorted-desc array, **invert YAKE score** for keyword sizing (e.g., `1 - normalize(scores)`), drop `analyzedAt`/server `inputText` if not displayed. Components stay roughly as they are; tests pin the adapter.
- **MSW success fixture must produce the backend shape, not the mock shape.** `mockAnalyze` can stay as a content generator inside the handler, but its output must be reshaped to the backend response before being returned. Otherwise tests encode the wrong contract.
- **Error model is incompatible.** UI's `kind: '4xx'` bucket needs to fan out into specific server codes (`EMPTY_INPUT`, `INPUT_TOO_LONG`, `INVALID_JSON`, `METHOD_NOT_ALLOWED`) plus the service-generated `THROTTLED` for 429. The `4xx` banner copy currently shows `error.detail`; that becomes `error.message` from the server envelope.
- **Client-side `MAX_LEN` should bump to 5000** to match the server, with the warn-at-90% / block-at-100% thresholds applying against the higher cap.
- **History schema stores the view-model, not the response.** Persisting the raw response would mix server `inputText` (200-char echo) with the user's full text. Spec §7 stores the user's full text; keep that, and store either the view-model or the raw response — pick one explicitly. Recommend: store the view-model so `HistoryList` can render without re-running the adapter.

### 5.2 Server-side validation precedence the client must respect

Spec `phase2-backend.md` §"Function URL event handling" fixes a contractual order that affects how the API client interprets responses and what the test matrix has to cover:

1. **Method check.** Non-`POST` returns `405 METHOD_NOT_ALLOWED` with an `Allow: POST` response header — even if the body is malformed.
2. **Base64 decode** if `isBase64Encoded` is true. Decode failure returns `400 INVALID_JSON`.
3. **JSON parse + object check.** Non-object JSON (`[]`, `42`, `"a string"`, `null`) returns `400 INVALID_JSON`.
4. **Schema/business validation.**
   - `text` missing, empty, whitespace-only, **or wrong type** (`42`, `[]`, `null`, etc.) → `400 EMPTY_INPUT`. The handler maps "wrong type" to `EMPTY_INPUT`, not `INVALID_JSON`.
   - `text` over 5000 chars → `422 INPUT_TOO_LONG`.

Implications:

- A `POST` with malformed JSON returns `400 INVALID_JSON` *before* any `text` check. The client must not assume `EMPTY_INPUT` is the first 400 a user can hit.
- A non-`POST` with malformed JSON still returns `405`, not `400`. Method beats body.
- `429 Too Many Requests` from reserved-concurrency exhaustion is **service-generated** and **does not** follow the `{error: {...}}` envelope. The client maps `429` to `THROTTLED` without parsing a body. Tests must not assert the handler envelope shape on 429.
- `405` responses include an `Allow: POST` header. Client tests should not assert its absence.

## 6. Current UI states

| State | Exists today? | Quality | Required Phase 3 action |
|---|---:|---|---|
| idle | Yes | Spec-aligned | Keep; port to `.tsx` |
| typing | Yes | Spec-aligned (counter, validation, sample chips, kbd hint) | Keep |
| loading | Yes | 4 tiers implemented; thresholds match spec | Keep tiering; have `useAnalysis` produce loading from a real `AbortController`-backed fetch |
| success | Yes | Renders sentiment + emotions + keywords; focus moves to heading; aria-live announces | Keep; revisit chart implementation per spec §8 (Recharts decision) |
| error | Yes | All 4 classes (network/timeout/4xx/5xx) with correct copy and retry policy | Keep copy; rewire to consume tagged `ApiError` from real client |
| retry-after-error | Yes | `retry()` re-runs with stored `lastInput` | Keep; ensure new `AbortController` per attempt |
| selected history | Yes | Renders saved result with mute caption; clears on new submit | Keep; route through `useHistory.select` and have `App` pass result into `ResultsPanel` |

## 7. Current history behavior

- localStorage used? Yes (useAnalysis.jsx:106-116).
- Storage key: `sa.history.v1` (spec calls for `sad:history:v1` — minor rename + one-time migration needed).
- Max entries: 50 (matches spec).
- Clear all supported? Yes, with confirm dialog (HistoryList.jsx:117-159).
- Known problems:
  - Schema drift from spec §7: persisted entries use `ts` / `input` instead of `timestamp` / `inputText`; the array is bare instead of wrapped in `{ version: 1, entries: [...] }`.
  - ID generation uses `${Date.now()}-${random}` instead of `crypto.randomUUID()`.
  - Persistence is mixed into `useAnalysis`; spec §5 mandates a separate `useHistory` hook so request lifecycle and persistence stay independently testable.
  - No malformed-storage recovery test (try/catch exists but is untested).

## 8. Styling and layout

- Styling approach: plain CSS in two files (`tokens.css` for design tokens, `app.css` for components and layout). No CSS modules, no CSS-in-JS, no Tailwind. References variables only — almost no hardcoded hex inside component logic.
- Responsive behavior: matches spec §10 exactly. Grid is single-column under 768px (app.css:63-71), two-column with full-width history at 768-1099px (app.css:73-80), and `1fr 1.5fr 1fr` three-column with history rail at ≥1100px (app.css:82-88). Container max-width 1280px with `clamp(16px, 4vw, 40px)` padding.
- Hardcoded colors/spacing:
  - A handful of greys not in tokens (`#c8c8c8`, `#cfcfcf`, `#f0f0f0`, `#f3f3f3`, `#f5f5f5`, `#f7f7f7`, `#f3f6fb`, `#f0f6ff`, `#fff8c5`, `#8d1313`, `#000`) used for hover/disabled/highlight states. Acceptable in CSS; flag any that creep into JSX during the port.
  - `App.jsx` `TweaksPanel` and `HistoryList.jsx` `SentimentBadgeMini` use inline `style={{...}}` blocks instead of classes — should move to CSS during port.
- Components that need design cleanup:
  - Tweaks panel — heavy inline styles, ad-hoc fontSize and padding values.
  - `SentimentBadgeMini` — duplicates `.sentiment-badge` with overrides in inline styles; promote to a `size="sm"` variant prop.
  - History timestamp tick uses `setInterval(30000)` and `setTick(x => x + 1)` — fine, but worth replacing with a single shared `useNow(60s)` hook so multiple list items don't each re-render on different intervals if the list grows.

## 9. Accessibility baseline

- Labels present for form fields? Yes — sr-only `<label htmlFor="text-input">` (TextInput.jsx:55).
- Keyboard navigation works? Mostly. Tab order matches visual order; Cmd/Ctrl+Enter submits; Esc clears (when not loading); sample chips and history items are real `<button>` elements. **`ConfirmDialog` is *not* a real modal** (HistoryList.jsx:117-159): it focuses Cancel on open and closes on Escape, but it has no focus trap, no `aria-modal="true"`, and no inert background — Tab can escape to the page behind the backdrop. Add a real focus trap and modal semantics during the port.
- Focus visible? Yes — universal `:focus-visible` outline rule in tokens.css:102-106 with 2px solid `--color-focus` and 2px offset; errors and success heading receive programmatic focus.
- Results announced or focus-managed? Yes — results region is `aria-live="polite"`, error banner is `role="alert"` with autofocus on appearance (ResultsPanel.jsx:88-90), success heading receives focus on result (ResultsPanel.jsx:151-155).
- Color-only meaning exists? No — sentiment badge has icon + text + color; emotion bars have label + value + color; chart has table fallback under `<details>`.
- Main issues:
  - No `eslint-plugin-jsx-a11y` running; rules are followed by hand.
  - No axe-core scan against any state.
  - No screen reader pass documented.
  - `aria-busy="true"` on the loading skeleton is good, but the surrounding `aria-live` may double-announce captions; verify with VoiceOver/NVDA during the manual pass.
  - Tweaks panel `role="dialog"` is non-modal and lacks focus trap — fine for a debug tool but should be removed from production builds.

## 10. Testing baseline

- Existing test runner: None. No Vitest, no Jest, no Playwright, no MSW.
- Existing tests: Zero.
- Missing critical tests (per spec §10):
  - `useAnalysis` state-machine transitions (idle → loading → success / error → retry; abort/cleanup on unmount)
  - `useHistory` localStorage behavior (cap-at-50, malformed-recovery, version-key handling, clear)
  - API client success/error class parsing (network / timeout / http / parse)
  - `ResultsPanel` rendering for each state branch
  - `TextInput` validation, counter behavior, disabled-during-loading
  - One Playwright happy-path smoke test (against MSW)
  - One axe scan over empty/loading/success/error states

## 11. Decision

- [ ] Preserve and refactor incrementally
- [x] Migrate in place to target Vite + React + TypeScript structure
- [ ] Replace frontend after documenting reason in `decision-log.md`

Reason: the UX surface is already correct and would be expensive to recreate (3-tier loading copy, error classes, color tokens, focus management, reduced-motion, sample-chip flow). The engineering scaffold (Vite, TS strict, real `analyzeText` client with `AbortController`, MSW, hook split, tests, ESLint, axe) is what's missing. Spec §2's decision rule — *"If it is React but not TypeScript, migrate carefully rather than rebuilding immediately"* — applies directly. Migrating in place preserves the working flows and produces a clearer portfolio narrative ("here's what I improved and why") than a rebuild.

Decision-log entries to write as the migration progresses, grouped by why each entry exists:

**Genuine deviations from spec** (need explicit justification):

- **Hand-rolled emotion bars vs Recharts.** Spec §8 explicitly picks Recharts; deviating needs a recorded reason (bundle size, declarative simplicity, "we already built it," etc.) or a switch to Recharts.
- **Persist view-model, not raw `AnalysisResponse`, in localStorage.** Spec §7 doesn't specify; this is a real design choice. Recommend recording the rationale: avoids re-running `toView` on every history render and decouples persisted shape from server changes, at the cost of needing a second migration if the view shape ever changes.
- **Tweaks panel.** Not described in the spec; current code ships it via `postMessage` hooks. Decide explicitly: remove, gate behind `import.meta.env.DEV`, or keep with justification.

**Implementation choices worth recording** (compliant with the spec, but the *how* is a design call):

- Storage key rename `sa.history.v1` → `sad:history:v1` with a one-time migration that reads the old key, writes the new wrapper shape, and leaves the old key in place per spec §7.
- History schema rename `ts` / `input` → `timestamp` / `inputText`, wrapped in `{ version: 1, entries: [...] }`. Same migration captures both.
- Error vocabulary: API client surfaces a tagged `ApiError` whose `kind` discriminates over `{network, timeout, parse, http, throttled}` with the server's `code` carried inside `kind: 'http'`. Banner classification (network/timeout/4xx/5xx) is derived in the consumer, not encoded in the error itself.

**Pure compliance with `phase3-frontend.md`** (no decision-log entry needed — recorded here so future readers don't mistake them for deviations):

- React 18 UMD → React 19 via Vite (spec §3)
- Mock shape rebuilt to match the backend contract (spec §4)
- Client `MAX_LEN` raised from 2000 to 5000 to match the server limit (spec §6)
- ID generation change to `crypto.randomUUID()` (spec §7)

## 12. Phase 3 refactor targets

Highest-priority changes (in execution order — test/lint infrastructure is set up in step 1 so step 2 onward can write tests as it goes):

1. **Scaffold Vite + React 19 + TypeScript strict + test/lint infrastructure in `frontend/`**, alongside existing files. Add `package.json`, `tsconfig.json` (strict + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` + `noImplicitOverride` + `@/*` alias), `vite.config.ts`, `index.html`, `src/main.tsx`. Dev deps: `vitest`, `@vitest/ui`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `jsdom`, `msw`, `eslint`, `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`, `prettier`. Wire `vitest.config.ts` and `src/test/setup.ts` so subsequent steps can write tests as the code lands. Keep the old HTML+Babel entry working until ports complete.
2. **Build the typed API layer** — types match the backend, not the mock (see §5.1, §5.2). `src/api/types.ts` mirrors `docs/phase2-backend.md` field-for-field (nested `sentiment`, object `emotions`, raw YAKE keyword scores, `inputText`, `analyzedAt`, server error envelope with required `field`). `src/api/client.ts` is `analyzeText(text, opts?)` over `fetch` with `AbortController`, 30s timeout, `VITE_LAMBDA_URL`, and a tagged `ApiError` discriminating over `{network, timeout, parse, http, throttled}`. `src/api/toView.ts` adapts the response into the display shape (lowercase → Title-Case sentiment, object → sorted-desc emotion array including `neutral`, **invert** YAKE keyword scores for chip sizing). `src/api/client.test.ts` covers every error class plus the precedence cases from §5.2 (POST + bad JSON returns `INVALID_JSON` not `EMPTY_INPUT`; non-POST + bad JSON returns `405`; wrong-type `text` returns `EMPTY_INPUT`; `429` maps to `THROTTLED` without parsing the body). `toView.test.ts` pins the reshape and the YAKE inversion.
3. **Split `useAnalysis` and `useHistory`.** Move localStorage out of `useAnalysis`; have `App` coordinate. Switch state to a discriminated union (`{ status: 'idle' } | { status: 'loading' } | { status: 'success', data } | { status: 'error', error }`).
4. **MSW handlers return the backend response shape** in `src/test/handlers.ts`. `mockAnalyze`'s content-generation logic can be reused inside the handler, but its output must be reshaped into the documented response (nested sentiment, object emotions including `neutral`, raw YAKE-style scores, `inputText`, `analyzedAt`) before being returned. One success handler plus one handler per error class from §5.2.
5. **Port components to `.tsx`** in dependency order: leaves first (`Atoms.jsx` split into `SentimentBadge/` carrying `SentimentIcon`, `EmotionChart/` carrying `EMOTION_COLORS`, `KeywordCloud/`, `shared/Spinner/`, `shared/Skeleton/`), then `TextInput`, `ResultsPanel`, `HistoryList`, then `App`. Extract `ConfirmDialog` to `components/shared/` and give it a real focus trap + `aria-modal="true"` (see §9). Implement score-based `KeywordCloud` chip sizing using inverted YAKE scores (see §3, §5.1).
6. **Component and hook tests** per spec §10 priority list: `useAnalysis` transitions (idle → loading → success / error → retry; abort/cleanup on unmount), `useHistory` localStorage (cap-50, malformed-recovery, version-key migration from `sa.history.v1`), `ResultsPanel` per state branch, `TextInput` validation. Lower-priority component tests (`SentimentBadge`, `EmotionChart`, `KeywordCloud`, `HistoryList`) follow if time allows.
7. **Add Playwright + axe-core** with two specs: happy path (against MSW), accessibility scan across empty/loading/success/error states. Zero axe violations to pass.
8. **Pre-tag acceptance work** (per spec §13):
   - Live Lambda contract sanity check — one `curl` against the deployed Function URL, verify shape against `src/api/types.ts`, record in `docs/phase3-results.md`.
   - Bundle size — run `vite build` and record gzipped initial-chunk size in `docs/phase3-results.md`. Target: < 250 KB.
   - Manual keyboard pass end-to-end, documented in `docs/phase3-results.md`.
   - Color-blind palette check — run final tokens through deuteranopia/protanopia/tritanopia simulator; if any two emotion colors collapse, swap one and document in `docs/phase3-results.md`.
   - `tsc --noEmit` and `eslint .` both clean.

Deferred to Phase 4 or later:

- Real cold-start UX timing validation against the deployed Lambda (Phase 4)
- CORS validation in the browser (Phase 4)
- Real timeout, 4xx, 5xx, network-failure paths against the deployed system (Phase 4)
- True word cloud (deferred to Phase 6 only if chips look weak)
- Single-entry history delete (Phase 6 polish — spec §7 marks this optional)
- Dark mode (out of scope for v1)
- Bulk CSV upload UI (Phase 7)
- CI integration of Playwright (Phase 5)
