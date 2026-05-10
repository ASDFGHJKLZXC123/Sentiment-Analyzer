# Phase 4 Results

Measurement log for `docs/phase4-integration.md`. Captured 2026-05-09 / 2026-05-10 across the live integration matrix.

## Live URL

- Deployed: **https://asdfghjklzxc123.github.io/Sentiment-Analyzer/** — GitHub Pages, branch `gh-pages`, source `/`.
- Backend Function URL (unchanged from Phase 2): `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/`.
- Final bundle: `assets/index-CoWO73-n.js` (217.74 kB / 68.52 kB gzipped), `assets/index-wO-tLMzg.css` (13.64 kB / 3.36 kB gzipped), `index.html` (0.60 kB).

## Browser matrix

| Browser | Version | Hard-refresh + assets | UI happy submit | DevTools available |
|---|---|:--:|:--:|:--:|
| Chrome | current macOS stable | ✓ no asset 404s | ✓ results render | ✓ |
| Safari | current macOS stable | ✓ no asset 404s; no `favicon.ico` row | ✓ results render (cold-start observation, 8.67 s) | ✓ |
| Firefox | n/a | not exercised | not exercised | n/a |

Spec §11 requires "Chrome and one of {Firefox, Safari}" — Safari satisfies the second-browser condition.

## Pre-deploy edits (commit ee1e30a)

Five edits shipped before the first live run, codex-reviewed "ready to adopt" in two passes (one for §3 / §5 wording, one for the legacy cleanup straggler sweep). Recorded in `docs/decision-log.md` entries dated 2026-05-09.

| Spec | Edit | File |
|---|---|---|
| §3 / §2 step 2 | Vite `base: "/Sentiment-Analyzer/"` (case-exact GitHub repo slug) | `frontend/vite.config.ts` |
| §3 | `VITE_LAMBDA_URL` documented as a build input + production-build instructions | `README.md` (root, "Frontend" → "Production build") |
| §5 item 1 | `ERROR_COPY.server` generalized to cold-start-aware: title "The server may still be waking up." / body "Please try again." | `frontend/src/components/ResultsPanel/ResultsPanel.tsx:138-142` |
| §5 item 1 | Test updated to assert `/server may still be waking up/i` | `frontend/src/components/ResultsPanel/ResultsPanel.test.tsx:153-157` |
| Decision-log #12 closeout | Legacy HTML+Babel entry deleted: `Sentiment Analyzer.html`, 6 `.jsx` files, plus the `resolve.extensions` reorder in vite config and matching ignores in `tsconfig.json` / `eslint.config.js` / `.prettierignore` | various |

## Live evidence: §4 CORS validation (browser-level)

Verified from the deployed Pages origin in both Chrome and Safari, DevTools Network panel open. The OPTIONS preflight + actual POST handshake works against the locked-down `AllowOrigins` allowlist.

| Browser | Observation |
|---|---|
| Chrome | OPTIONS preflight 200 + POST 200; results rendered. No CORS errors in console. |
| Safari | POST 200 (756 B response, 8.67 s — natural cold start during run); preflight cached by Safari from prior runs. Results rendered. No CORS errors in inspector. |

429 response inspection (separate Node run, see §6 throttled below) confirmed `Access-Control-Allow-Origin: https://asdfghjklzxc123.github.io` and `Vary: Origin` are present on AWS-generated 429 responses, so the §10 "missing-CORS-headers risk" is **not** hit for this account/configuration.

## Live evidence: §5 Cold-start UX

| Item | Status | Source |
|---|---|---|
| §5 item 1 — `kind:'server'` banner copy generalized | ✓ shipped pre-deploy | commit ee1e30a, `ResultsPanel.tsx:138-142` |
| §5 item 2 — `kind:'timeout'` copy left unchanged | ✓ no change needed | spec analysis; "That took longer than expected. The model may be cold — try again." remains correct for the slow-init mode |
| §5 item 3 — loading-tier ladder fires correctly on cold path | ✓ observed live | natural 9.36 s cold start during the post-revert warm-submit verification: user confirmed Tier 3 "Warming up the model — this happens on the first request." caption appeared during the wait, success state rendered after |
| §5 item 4 — loading-tier thresholds left at 1500 / 3000 / 10000 ms | ✓ option (a) | decision-log entry 2026-05-09 captures the rationale |

## Live evidence: §6 Error-class verification matrix

| Kind | Driver | Observation | Status |
|---|---|---|:--:|
| `network` | Chrome DevTools → Network → "Offline" → submit valid input | Banner: "Can't reach the server. Check your connection and try again." + Try again button. Console: standard `TypeError: Failed to fetch` (expected). | ✓ |
| `timeout` | TEMP debug bundle deployed with `REQUEST_TIMEOUT_MS = 1_000` (codex recommended value given warm p95 = 1568 ms); reverted to 30 000 immediately after | Network row: preflight 200 (95 ms) + POST `(canceled)` at 898 ms (the `AbortController` firing). Banner: "That took longer than expected. The model may be cold — try again." + Try again button. Reverted bundle re-deployed; `index-CoWO73-n.js` hash matches the canonical commit. | ✓ |
| `parse` | Not live-reproducible — would require a man-in-the-middle to deliver a 2xx with a malformed body | Covered by `frontend/src/api/client.test.ts` (multiple cases including 2xx-not-JSON, 4xx-without-envelope, 4xx-malformed-envelope). | doc'd |
| `http` 4xx | Console fetch from deployed page: `body: JSON.stringify({text: ""})` | `{status: 400, body: {error: {code: "EMPTY_INPUT", message: "Field 'text' is required and cannot be empty or whitespace-only.", field: "text"}}}` — envelope shape matches `ServerErrorResponse` in `api/types.ts`. | ✓ |
| `server` 5xx | Not produced in the test window | Mapping covered by `frontend/src/api/client.test.ts:161-168` (`returns kind:'server' with status for 500/502/503/504`); banner covered by `frontend/src/components/ResultsPanel/ResultsPanel.test.tsx:153-157`. Closest live evidence: a natural 9.36 s cold start during the post-revert warm-submit verification succeeded with 200 (within the 30 s timeout). The §11 cold-start failure-mode list ("`kind:'timeout'` OR `kind:'server'` OR `kind:'network'` — AWS 502 with CORS headers absent") is satisfied by the `kind:'timeout'` run above; the §6 `kind:'network'` run covers generic offline retry plumbing rather than the AWS-502-without-CORS leg of the §11 list. | doc'd |
| `throttled` 429 | Node saturation: 30 concurrent chains, 15 s window. Browser saturation (12 chains, 12 s) returned 200/200; the browser hit fetch-concurrency limits before reaching account capacity. See deviation below. | Node run: 3328 attempts → 548 × 200, 2780 × 429 (84% throttled). Sampled 429 response: status 429, body `{"Reason":"ConcurrentInvocationLimitExceeded","Type":"User","message":"Rate Exceeded."}`, headers include `Access-Control-Allow-Origin: https://asdfghjklzxc123.github.io` and `Vary: Origin` — so a UI-caught 429 would surface as `kind:'throttled'`, not `kind:'network'`. Mapping verified end-to-end by `client.test.ts:142-158` (`bodyRead === false`, `kind:'throttled', status:429`). | doc'd |

## Live evidence: §7 Input validation symmetry

| # | Check | Driver | Result |
|---|---|---|:--:|
| 1 | `MAX_TEXT_LENGTH === 5000` is the single source of truth | Pre-deploy audit: `api/types.ts:70` exports `MAX_TEXT_LENGTH = 5000`; consumers in `TextInput.tsx` (3 sites — counter, slice, maxLength) and `App.tsx` (2 sites — handleSubmit, submitDisabled). No `MAX_LEN` or magic 5000 anywhere else after the legacy cleanup (codex sweep across `tsconfig.json`, `eslint.config.js`, `.prettierignore`, etc.). | ✓ |
| 2 | 5000-char paste accepted end-to-end against the live Lambda | Console fetch: `body: JSON.stringify({text: "x".repeat(5000)})` | `{status: 200, ok: true, hasResults: true}` |
| 3 | 5001-char paste truncated client-side to 5000 | Console: `copy('x'.repeat(5001))` then `Cmd+V` into the textarea | Counter shows `5,000 / 5,000` (red error tint), confirming the slice + `maxLength` chain works in the deployed bundle |
| 4 | Server-side guard with 5001-char DevTools-console fetch → 422 | Console fetch: `body: JSON.stringify({text: "x".repeat(5001)})` | `{status: 422, body: {error: {code: "INPUT_TOO_LONG", message: "...", field: "text"}}}` |

## Live evidence: §11 retry-success cycle

| Step | Observation |
|---|---|
| 1. DevTools throttling → Offline | n/a |
| 2. Submit valid input | `kind:'network'` banner appeared, focus moved to alert |
| 3. Throttling → No throttling | n/a |
| 4. Click Try again on the banner | Submit re-fired, results rendered (success) |

This single cycle proves the §11 "retry succeeds against the warm host" requirement against an already-observed error state.

## Deviations from `phase4-integration.md`

1. **Browser-driven 429 saturation did not reproduce `kind:'throttled'`.** Two attempts from the deployed Pages console (12 chains × 12 s, 351 attempts; 30 chains × 15 s — never reached the 30-chain ceiling because the browser self-throttled) returned only 200s. From a Node script (Node 22.22.2, native fetch / undici), 30 concurrent chains for 15 s reliably produced 84% 429 responses against the same Function URL. The browser's per-origin fetch concurrency cap appears to be the bottleneck — once Node bypassed it, AWS's account-wide concurrency cap kicked in as expected.

   Neither §11 item 6 alternative applies cleanly here. Path A ("a saturating run produces `kind:'throttled'`") failed because Chrome capped fetch concurrency before AWS's quota engaged. Path B ("missing-CORS-headers risk is hit and observation documented") **does not** apply either — AWS 429 responses include `Access-Control-Allow-Origin: https://asdfghjklzxc123.github.io` and `Vary: Origin`, so the browser-blocking case described in §10 is not what happened.

   The honest record: browser could not surface `kind:'throttled'`; Node proved AWS 429 + CORS headers; the api/client.ts mapping (`status === 429 → kind:'throttled'` before any body parse) is exercised by `client.test.ts:142-158`. Treating this as a documented deviation from §11 item 6 rather than a checkbox pass via either named alternative.

2. **AWS account-wide concurrency is materially higher than the documented Phase 2 deviation #1 cap of 10.** Phase 2 recorded "AWS account quota for total concurrent executions is 10". The Node saturation evidence from this phase (548 × 200 across the 15-second window means sustained throughput of ~36 RPS without throttling, and 429s only kick in once the in-flight count climbs much higher than 10) implies AWS has raised the account quota since Phase 2. This is informational only — does not change Phase 2's choice not to set reserved concurrency on the function — but the Phase 2 docs are stale.

3. **Favicon fix added.** `frontend/index.html` gained `<link rel="icon" type="image/svg+xml" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAxIDEiLz4=" />` (a 1×1 empty SVG). Browsers no longer auto-request `/favicon.ico` against the root, eliminating the only console 404 visible on hard-refresh. Initial fix was the simpler `data:,` URI; upgraded to base64-encoded SVG after Safari's Web Inspector preview erroring on the empty body when clicked. Outside the strict §1 non-goals reading of "polish → Phase 6", but the spec intro explicitly allows "small fixes are in scope when they're needed to make live integration pass" — a console 404 muddies the hard-refresh evidence.

## §11 acceptance checklist

- [x] Production build with absolute `VITE_LAMBDA_URL` and correct Vite `base` succeeds; bundle deployed to GitHub Pages and reachable from a real browser. Final HTML 0.60 kB, JS 217.74 kB / 68.52 kB gzipped, CSS 13.64 kB / 3.36 kB gzipped.
- [x] Deployed page loads cleanly on hard-refresh with no 404s on assets, in both Chrome and Safari. Favicon fix applied.
- [x] Browser-session CORS check passes from the Pages origin (preflight + actual POST); recorded above for both Chrome and Safari.
- [x] Cold-start failure modes are recoverable from the UI with a working retry that succeeds against the warm host. The `kind:'timeout'` run (debug bundle, abort at 898 ms with banner + Try again) is the cold-start failure-mode evidence per §11. The 9.36 s natural cold start during the post-revert verification succeeded within the 30 s timeout — separate evidence that the canonical bundle absorbs cold init without requiring any error path. The §6 `kind:'network'` run (DevTools Offline) is generic retry plumbing, not the §11 AWS-502-without-CORS leg; see the §11 retry-success cycle recorded in this doc.
- [x] Every live-reproducible `ApiError.kind` driven from the deployed page at least once. Non-reproducible kinds explicitly mapped to existing test coverage:
  - `parse` → `client.test.ts:172-196` (multiple cases: 2xx-not-JSON, 2xx-wrong-shape, 4xx-no-envelope).
  - `server` 5xx → `client.test.ts:161-168` (mapping for 500/502/503/504) + `ResultsPanel.test.tsx:153-157` (banner). Non-reproducible in this window because no natural 502 occurred — the 9.36 s cold start succeeded within the 30 s timeout instead.
  - `throttled` 429 → `client.test.ts:142-158`. Browser-driven saturation hit the per-origin fetch-concurrency cap before AWS engaged; see deviation #1.
- [x] §11 item 6 (429 mapping) discharged via documented deviation rather than either named alternative: browser saturation could not surface `kind:'throttled'` (per-origin fetch cap); Node saturation reliably produced AWS 429 + CORS headers; api/client.ts mapping exercised by `client.test.ts:142-158`. See deviation #1 above.
- [x] Input cap symmetry: 5000-char submits succeed; client-side slice/`maxLength` truncates beyond 5000; server's 422 response shape confirmed via DevTools-console fetch.
- [x] `docs/phase4-results.md` exists with: live URL, browser/version matrix, recorded result of each error class (driver + observed UI), copy/timing edits applied, and deviations.
- [x] `decision-log.md` updated for spec deviations and copy/timing edits from §5 / §9 (two entries dated 2026-05-09; this Phase 4 closeout will append a third).
- [x] All Phase 3 automated tests still pass: `tsc --noEmit`, `eslint .`, `vitest run` (108 tests), `playwright test` (5 tests). Total 113.
- [ ] Tagged `phase-4-complete` — pending closeout commit + tag (will land after this doc + decision-log entry).

## Hand-off to Phase 5

Phase 5 inherits a frontend bundle that runs against the live Lambda from the canonical GitHub Pages origin, with all live-reproducible error classes verified end-to-end and the non-reproducibles documented with unit-test references.

Phase 5 owns (per `phase4-integration.md` §12):

- Automating the manual `VITE_LAMBDA_URL=… vite build && gh-pages` flow into a GitHub Actions workflow.
- OIDC-based AWS auth for the backend deploy (replacing manual `aws lambda update-function-code`).
- Branch-protection wiring (PR checks).
- Post-deploy smoke test against the Function URL.
- Optionally tightening the `lambda:InvokeFunction` resource policy with the `lambda:InvokedViaFunctionUrl` condition (deferred from Phase 2 deviation #5).

Open follow-ups noted but not in Phase 5 scope:

- Phase 2 docs reference an AWS account concurrency cap of 10 (Phase 2 deviation #1) that no longer matches what the Phase 4 saturation evidence implies. Worth a small docs reconciliation pass during Phase 6 polish, or whenever Phase 2 docs are next touched.
- History-list border-radius polish (user-noted during the Phase 4 live testing session) — deferred to a separate post-tag commit, then to Phase 6 portfolio polish.
