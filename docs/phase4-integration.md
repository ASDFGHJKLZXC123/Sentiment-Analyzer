# Phase 4: Integration & Live-Stack Hardening

**Status:** Pending start
**Prerequisites:** `phase-3-complete` tag (✓), deployed Function URL `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/` (✓), `VITE_LAMBDA_URL` mechanism in place (✓), Vite dev proxy at `/api/analyze` (✓), CORS allowlist locked to `https://asdfghjklzxc123.github.io` (✓).
**Exit criteria:** Frontend runs end-to-end against the deployed Lambda from the GitHub Pages origin; every **live-reproducible** `ApiError.kind` has been driven from the deployed page at least once, with non-reproducible kinds explicitly mapped to existing unit-test coverage; cold-start UX (both browser-`timeout` and AWS-`502` paths) is recoverable from the UI without a reload; CORS confirmed in a real browser session, not just curl. Tag `phase-4-complete`.

Phase 4 is **integration + minimum hardening**, not pure verification. Per `project-plan.md` §Phase 4 the roadmap says "connect" and "harden" — small fixes are in scope when they're needed to make live integration pass: env wiring, GitHub Pages base path, error-banner copy, 429 mapping fix (if mis-mapped), input-limit mismatches. New product features still belong in `decision-log.md`.

---

## 1. Goals and non-goals

### Goals
- Replace MSW/mock data with the deployed Lambda for the production build, served from the canonical GitHub Pages origin.
- Drive every live-reproducible `ApiError.kind` against the real system from the deployed page; document the non-reproducible kinds with the unit test that covers them.
- Validate CORS in an actual browser tab — preflight + actual POST — from the GitHub Pages origin.
- Harden the cold-start path so that **both** observed failure modes are recoverable from the UI: a browser-side `timeout` and an AWS-generated `502 Bad Gateway`.
- Confirm input validation parity end-to-end (5000-char ceiling mirrors backend).
- Produce a working live demo candidate.

### Non-goals (deferred)
- Portfolio polish, recruiter walkthrough copy, demo URL grooming → Phase 6 (`project-plan.md` §Phase 6).
- GitHub Actions / CI deploys → Phase 5.
- Provisioned concurrency / cold-start elimination → Phase 6.
- Bulk CSV → Phase 7.
- New API features. Contract is frozen at the Phase 2 envelope.
- Custom domain or auth → out of scope per Phase 1 non-goals.

If a "while we're in here" item appears, push back to decision-log first.

---

## 2. Order of operations

This sequence matters: each step's evidence depends on the previous step. Do not reorder. All `npm` commands run from `frontend/` (no root `package.json`).

1. **Confirm baseline.** `phase-3-complete` tag present; working tree clean. From `frontend/`: `npm run typecheck && npm run lint && npm test && npm run e2e` all pass.
2. **Set Vite `base`.** Configure `vite.config.ts` `base` for the GitHub Pages path. Project pages at `https://asdfghjklzxc123.github.io/Sentiment-Analyzer/` → `base: '/Sentiment-Analyzer/'` (case-exact match to the GitHub repo slug, per `git remote -v`). Verify locally with `npm run build && npm run preview` that asset URLs resolve under the chosen base.
3. **Production build with absolute Lambda URL.** `VITE_LAMBDA_URL=https://...lambda-url.../ npm run build`. Confirm the Function URL is inlined into the bundle (grep `dist/`).
4. **Push to GitHub Pages.** Manual `gh-pages` deploy; record the public URL.
5. **Validate happy-path CORS in a real browser** at the Pages URL (§4).
6. **Run error / input / throttling matrix** from the deployed page (§6, §7).

Local `vite preview` from `localhost:4173` against the absolute Lambda URL is **not a CORS dry run**: `localhost:4173` is not in the Lambda's `AllowOrigins`, so CORS will fail there by design. Local preview is only for asset-path and bundle-resolution checks.

---

## 3. Production environment wiring

### `VITE_LAMBDA_URL` in production builds

`vite build` reads `VITE_LAMBDA_URL` at build time. Phase 3's dev proxy makes the value `/api/analyze`; production needs the absolute Function URL because the deployed bundle is served from GitHub Pages and there is no proxy.

- Local production-build smoke (asset/bundle only): `VITE_LAMBDA_URL=https://...lambda-url.../ npm run build && npm run preview`. Open in the browser to confirm the bundle loads, scripts resolve under the chosen `base`, and the Function URL is inlined. Do **not** treat this as a CORS check; CORS validation begins at step 5 above.
- Document the env var as a build input alongside `frontend/README.md` or in a new section there.
- **Do not** introduce CI yet. Phase 5 owns automated injection. Manual `VITE_LAMBDA_URL=... npm run build` and a hand-`gh-pages`-push is acceptable for this phase.

### Vite `base` for GitHub Pages

If the deployed URL is `https://asdfghjklzxc123.github.io/<repo>/`, asset paths must be prefixed with `/<repo>/`. Set `base: '/<repo>/'` in `vite.config.ts` (or pass `--base /<repo>/` to `vite build`). If the project ends up at the root of a user-pages site, `base: '/'` is correct. Verify by hard-refreshing the deployed URL and confirming no 404s on `/assets/*.js` or `/assets/*.css`.

### CORS allowlist for the preview origin

Decision: how to exercise the deployed bundle in a browser without violating the Phase-2-locked `AllowOrigins`?

| Option | Cost | Trade-off |
|---|---|---|
| **A. Push a real GitHub Pages preview to the canonical origin** | One-time `gh-pages` push, no CORS change | Requires the bundle to be reasonable; aligns with Phase 5's eventual deploy |
| B. Temporarily add `http://localhost:4173` to `AllowOrigins` | One AWS update, one revert | Modifies live infra for a local check; previously rejected in 2026-05-09 entry for a similar case |
| C. Keep using Vite dev proxy at `localhost:5180` | Zero infra change | Doesn't exercise CORS — that's the whole point |

**Adopting Option A.** Closest to Phase 5's eventual automated workflow; if A works manually here, Phase 5 becomes a workflow-yaml port of those commands.

---

## 4. CORS validation (browser-level)

Phase 2 verified the preflight via curl (`docs/phase2-results.md` deployed smoke table, row 5). Phase 4 verifies it from a real browser session because curl skips the actual `Origin`-header / fetch-credentials interaction.

Steps:
- Open the deployed page in Chrome with DevTools → Network panel.
- Submit valid input. Confirm: one `OPTIONS` preflight (200, with the `Access-Control-Allow-*` headers we already saw via curl), then one `POST` (200, response body is the JSON envelope).
- Submit input that triggers a 4xx **via the deployed page** — see §6 for the actual mechanism (the UI client-side-blocks empty input and slices over-length, so this is driven from the DevTools console).
- Repeat from a second browser (Firefox or Safari) — Safari historically has stricter preflight caching that has bitten this kind of setup.
- Record both runs in `docs/phase4-results.md` (new doc).

If CORS fails: investigate the `Vary: Origin` header, `MaxAge: 300` cache, and the case-sensitivity of `AllowHeaders: content-type`. Do not reach for `*` origin as a fix.

---

## 5. Cold-start UX hardening

Phase 2 documented two cold-start failure modes (`docs/phase2-results.md` deviation #6 + cold-start nuance):

- **Re-provisioned host:** ECR image pull (~60+ s on a fresh instance) exceeds the 30 s function timeout → AWS returns **`502 Bad Gateway`** with no JSON body and possibly **without CORS headers** (see §10 risk).
- **Slow init on a 2048+ MB instance:** init takes 5–15 s even with the image cached → may surface as a browser-side `timeout` (`AbortController` at 30 s) if init drags.

Phase 3's `useAnalysis` already maps these to `kind: 'server'` (5xx) and `kind: 'timeout'` respectively, with their own banner copy + retry. The remaining work in Phase 4 is:

1. **Tighten the `kind: 'server'` banner copy.** Current: "Something went wrong on our end. This is rare — please try again." This is misleading when the most common cause is a re-provisioned cold start. Generalize to something like: "The server may still be waking up — please try again." Single-line copy edit; no new state, no new error kind. The `kind: 'cold-start'` discriminator was considered and rejected because (a) it leaks an infra guess into the client contract, and (b) the browser may not even see the AWS 502 status if CORS headers are absent on service-generated failures (see §10), so any cold-start-specific behavior would already be wrong half the time.

2. **Confirm the `kind: 'timeout'` copy is also cold-start-aware.** Current: "That took longer than expected. The model may be cold — try again." This is fine; document that this banner is the right one for the slow-init mode.

3. **Confirm the loading-tier ladder still fires correctly on retry.** Phase 3 §3 (Tier 3 ≥ 3 s) shows "Warming up the model — this happens on the first request." Verify in the live environment that a second submit after a 502 retry re-enters Tier 3 if it crosses 3 s. Unit-tested in `useAnalysis.test.tsx`; live-confirm.

4. **Re-evaluate loading-tier thresholds against real warm-path numbers.** `phase2-results.md` records warm p95 = **1,568 ms** end-to-end at 3008 MB (handler inference 600–900 ms + Function URL/network overhead). The Phase 3 ladder (`ResultsPanel.tsx:84-91`) is: `<1500 ms` spinner (Tier 1), `1500–3000 ms` silent skeleton (Tier 2), `3000–10000 ms` skeleton + "Warming up the model" caption (Tier 3), `≥10000 ms` skeleton + "Still working" caption (Tier 4). At a warm p95 of 1,568 ms, the slow 5% of warm requests tip into **Tier 2** (silent skeleton) for ~70 ms before the success state replaces it — they do **not** trigger the Tier 3 "Warming up" caption. The misleading-caption risk is not present.

   Two choices on the spinner-to-skeleton break:
   - **(a)** Leave thresholds at 1500/3000/10000. The brief Tier 2 flash on warm-p95 outliers is not visually disruptive (it's a subtle skeleton, not a copy change), and the Tier 3 caption still fires only on genuine cold starts. **Recommended.**
   - **(b)** Move the spinner-to-skeleton break from 1.5 s to 2 s so the spinner stays visible throughout the warm-path normal range. One-line change in the timer constants; not strictly necessary.

   Decision recordable during Phase 4 in `decision-log.md` either way.

**Out of scope:** silent auto-retry on 502/504. Considered (would absorb the re-provision bump invisibly), deferred to Phase 6 polish. The hand-clicked retry already works and will be the documented exit criterion.

---

## 6. Error-class verification matrix

For each `ApiError.kind`, drive a real failure if reproducible from the deployed page; otherwise document the unit-test reference. Distinguish browser/UI evidence from DevTools-console-`fetch` evidence and from unit-test-only coverage. Record everything in `docs/phase4-results.md`.

| Kind | Live-reproducible from the UI? | How to drive | Expected UI |
|---|---|---|---|
| `network` | Yes | DevTools → Network → "Offline", then submit valid input | "Can't reach the server…" banner + retry |
| `timeout` | Yes (cold start > 30 s) | Wait for Lambda to idle ≥ a few hours, then submit. Or temporarily lower `REQUEST_TIMEOUT_MS` in a debug build | "That took longer than expected. The model may be cold — try again." + retry, focus to alert |
| `parse` | Practically no | Cannot drive without a man-in-the-middle. Covered by `api/client.test.ts` (every error class). Document the test reference; do not fake a driver. | (Not exercised live) |
| `http` (4xx) | Not from the UI form (client-side guards block empty/over-length input). Drive from DevTools **console** at the deployed page: `const LAMBDA_URL = "https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/"; fetch(LAMBDA_URL, {method:'POST', headers:{'content-type':'application/json'}, body:'{"text":""}'}).then(r => r.json()).then(console.log)`. (Note: `VITE_LAMBDA_URL` is a build-time source replacement, not a runtime global, so use the literal URL or assign it to a `const` first.) The console is same-origin with the Pages page, so this exercises the real Pages → Function URL CORS path. | Confirm 400 `EMPTY_INPUT` body matches the contract; the UI banner is covered by `ResultsPanel.test.tsx`. Document the network-tab result. |
| `server` (5xx) | Best evidence is a **natural 502 cold start** during the test window — Phase 2 deviation #6 documents this happens when an idle function gets a re-provisioned host. Don't try to fake it via path manipulation; Lambda Function URLs invoke the same handler regardless of path. If no natural 502 is observable, fakes have known limits: (a) DevTools Local Overrides can rewrite response *body* and *headers* but **not** the HTTP status code — a 200 with a synthetic 502-shaped body will actually fire `kind: 'parse'` in the client, not `kind: 'server'`. (b) Substitute external 5xx endpoints (`httpbin.org/status/503` etc.) only work if they include `Access-Control-Allow-Origin` on the error response, which most don't. So treat any synthetic substitute as a **UI-only interception test** (the banner renders correctly given a fabricated `kind: 'server'` state — already covered by `ResultsPanel.test.tsx`), not as CORS-preserving 5xx evidence. The exit criterion (§11) accepts either a natural 502 observation or a documented "no natural 502 observed in test window" with the unit-test reference. | "The server may still be waking up — please try again." + retry |
| `throttled` (429) | Conditional. The Lambda's reserved concurrency was **not applied** (`phase2-results.md` deviation #1) — the account-wide concurrency cap is 10 with an unreserved floor of 10, so saturation must hit the **account**, not the function. Two-step driver: (1) From a Node script (or several DevTools console parallel `fetch` calls from the deployed page), fire ~30 in-flight POSTs to the Function URL to consume the account concurrency. (2) While saturated, submit one final request **from the deployed page UI** to capture the throttled banner. Step 2 is what closes the loop on Pages-origin CORS + UI client behavior. | Throttled banner + retry. Confirm the API client maps a 429 (often with no parseable body, possibly with no CORS headers — see §10) to `kind: 'throttled'`, not `server`/`parse`. If misclassified, fix `api/client.ts`; tests in `api/client.test.ts` should cover the body-empty and body-AWS-XML 429 variants. |

If a kind cannot be reproduced cleanly, document why and rely on the existing unit test instead of inventing a fake driver.

---

## 7. Input validation symmetry

The backend caps `text` at 5000 chars (returns 422 `INPUT_TOO_LONG`). The frontend's `TextInput` enforces the cap client-side via `maxLength`, an `onChange` slice (`value.slice(0, MAX_TEXT_LENGTH)`), and a submit-disabled guard. The cap is exported from `api/types.ts` as `MAX_TEXT_LENGTH = 5000`.

- [ ] Verify `MAX_TEXT_LENGTH === 5000` is the single source of truth.
- [ ] Confirm a 5000-char paste submits successfully end-to-end against the live Lambda (200 envelope).
- [ ] Confirm a 5001-char paste is truncated client-side to 5000 (the slice + `maxLength`); the textarea will not hold 5001.
- [ ] Confirm the **server-side guard** still works by issuing a DevTools-console `fetch` from the deployed page with a 5001-char body. (Use a literal Function URL or `const LAMBDA_URL = "..."` — `VITE_LAMBDA_URL` is build-time only.) Expect `422 INPUT_TOO_LONG`. The UI's response handling for that kind is covered by `ResultsPanel.test.tsx` and `api/client.test.ts`.

The naive idea — "remove the `disabled` attribute and try a 5001-char paste" — won't actually bypass anything, because the client-side defenses (`maxLength`, `onChange` slice, `handleSubmit` guard) all run regardless of the button state. DevTools-console `fetch` is the realistic bypass path; that's how server-side validation gets exercised end-to-end.

Recorded as four checkboxes in `docs/phase4-results.md`. No code changes expected unless `MAX_TEXT_LENGTH` is mis-set.

---

## 8. End-to-end Playwright (deployed-stack evidence)

`project-plan.md` §Phase 4 explicitly lists "End-to-end testing across the deployed stack." Phase 4 honors that with **a documented manual browser run from the Pages origin** (the §4 + §6 + §7 matrix). It does **not** add a maintained live-Lambda Playwright suite to CI, because the live Lambda will cold-start on every PR run and produce 502s and timeouts that will make a CI suite chronically flaky and expensive.

If a single on-demand happy-path spec is genuinely cheap, a `npm run e2e:live` script targeted at the deployed URL is acceptable. It must not run as part of `npm test`, `npm run e2e`, or any CI check. Default: skip in favor of the manual matrix.

---

## 9. Copy and timing tuning

Allowed scope of edits, given §5 and §6 observations:

- Copy edit to `kind: 'server'` banner per §5 item 1.
- Copy refinements to other banners only if a real run shows the user-facing message is wrong.
- Loading-tier timing change per §5 item 4 (recommend leaving thresholds at 1.5/3/10 s; brief Tier-2 silent skeleton on warm-p95 outliers is not visually disruptive).
- 429 mapping fix in `api/client.ts` if §6 surfaces a mis-map.
- Retry-button labels (currently "Try again" — fine, no edit expected).

Out-of-scope edits:
- New error kinds. The discriminated union `{network, timeout, parse, http, server, throttled}` stays as-is.
- New states. The state machine (`idle`, `loading[1|3|10]`, `success`, `error`, `selected-history`) is frozen.
- New components.
- Re-styling.
- Silent auto-retry (Phase 6).

---

## 10. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| `gh-pages` push surprises (asset paths, base URL) | Medium | Vite `base` config per §3; do a dry-run with `npm run preview` first; hard-refresh the deployed URL and watch DevTools for 404s |
| Live Lambda goes 502 during the verification matrix | High | Expected; documented as part of cold-start hardening evidence (§5) |
| **AWS service-generated `429`/`502`/`504` may be returned without CORS headers.** A browser POST from the Pages origin would then surface as `kind: 'network'`, not `throttled` / `server` — even when curl/Node sees the correct status. | Medium | Note in `phase4-results.md`; do not silently re-classify. If it happens, document the observed behavior and accept it (the alternative — wrapping the Function URL in API Gateway to inject CORS on errors — is Phase 5+ scope). |
| Account-wide concurrency cap = 10 (per `phase2-results.md` deviation #1) makes saturation testing easy but means a single unrelated invocation can race the 429 driver | Low | Test in a quiet window; the saturation script exits after one observed 429 |
| Browser caches preflight responses; second test run sees stale headers | Medium | DevTools "Disable cache" checkbox, or test in incognito |
| Vite `base` mis-set → blank page on Pages | Medium | Hard-refresh + DevTools network tab during step 4 |
| Frontend code drift since `phase-3-complete` tag | Low | Working tree clean as of 2026-05-09 |
| "While we're in here" feature creep | High | §1 non-goals; decision-log required to expand scope |

---

## 11. Acceptance checklist

Before tagging `phase-4-complete`, every item below is true:

- [ ] Production build with absolute `VITE_LAMBDA_URL` and correct Vite `base` succeeds; bundle deployed to GitHub Pages and reachable from a real browser.
- [ ] Deployed page loads cleanly on hard-refresh with no 404s on assets, in both Chrome and one of {Firefox, Safari}.
- [ ] Browser-session CORS check passes from the Pages origin (preflight + actual POST); recorded in `docs/phase4-results.md`.
- [ ] Cold-start failure modes are recoverable from the UI with a working retry that succeeds against the warm host. Acceptable observations: `kind: 'timeout'` (browser-side abort at 30 s); `kind: 'server'` (AWS 502 with CORS headers present); `kind: 'network'` (AWS 502 with CORS headers absent — see §10 risk). All three are valid Phase-4 outcomes; record which mode(s) were observed in `phase4-results.md`. The constant requirement is that retry succeeds, not that any specific kind appears.
- [ ] Every **live-reproducible** `ApiError.kind` driven from the deployed page at least once. Non-reproducible kinds explicitly mapped to existing test coverage with a reference (currently expected: `parse`).
- [ ] 429 mapping confirmed: a saturating run produces `kind: 'throttled'` (not `server`/`parse`) **or** the missing-CORS-headers risk is hit and the observation is documented.
- [ ] Input cap symmetry: 5000-char submits succeed; client-side slice/`maxLength` truncates beyond 5000; server's `422` response shape is confirmed via DevTools-console `fetch` and matches `api/client.test.ts` expectations.
- [ ] `docs/phase4-results.md` exists with: live URL, browser/version matrix, recorded result of each error class (driver + observed UI), copy/timing edits applied, and any deviations.
- [ ] `decision-log.md` updated for any spec deviations or copy/timing edits from §5 / §9.
- [ ] All Phase 3 automated tests still pass: `tsc --noEmit`, `eslint .`, `npm test`, `npm run e2e`.
- [ ] Tagged `phase-4-complete`.

---

## 12. Hand-off to Phase 5

Phase 5 inherits a frontend bundle that runs against the live Lambda from the canonical GitHub Pages origin, with all live-reproducible error classes verified.

Phase 5 owns:
- Automating the manual `VITE_LAMBDA_URL=... vite build && gh-pages` flow into a GitHub Actions workflow (frontend deploy).
- OIDC-based AWS auth for the backend deploy (replacing the manual `aws lambda update-function-code` loop).
- Branch-protection wiring (PR checks).
- Post-deploy smoke test (a curl-against-the-Function-URL job after each backend deploy).
- Optionally: tightening the `lambda:InvokeFunction` resource policy with the `lambda:InvokedViaFunctionUrl` condition (deferred from Phase 2 deviation #5).

If Phase 4 leaves a working live demo and a confirmed CORS posture, Phase 5 becomes a packaging exercise rather than a debugging exercise.
