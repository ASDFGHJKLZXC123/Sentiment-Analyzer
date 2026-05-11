# Phase 6: Polish and portfolio readiness

**Status:** Pending start
**Prerequisites (verify before starting):**
- `phase-5-complete` tag present on `main` (`git tag -l phase-5-complete`).
- CI/CD pipeline live: `pr-check` + `deploy-frontend` + `deploy-backend` workflows exist and each has at least one green run on `main`.
- Live URL https://asdfghjklzxc123.github.io/Sentiment-Analyzer/ serving on hard-refresh.
- Backend Function URL `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/` reachable.
- Branch protection on `main` active (required `pr-check`, no force-push, no deletion).
- `phase5-results.md` §10 checklist fully checked, including item 11 — flip that to `[x]` as part of starting Phase 6 if it isn't already.

All Phase 6 changes land via PR; direct push to `main` is blocked by protection (admin bypass possible but avoid by convention).
**Exit criteria:** A recruiter visiting the live URL or the GitHub repo can understand what the project does in under two minutes. The README has the screenshot, the architecture overview, the live demo link, and the dev-setup instructions. The deployed UI ships pre-loaded demo content the recruiter can click to see the model in action without typing anything. The performance baseline (cold start, warm latency, image size) is captured in a single doc that's linked from the README. Cost monitoring is verified still active. Phase 5 carry-overs are either resolved or explicitly re-deferred to a future phase with a note. Tag `phase-6-complete`.

Phase 6 is **polish**, not feature work. No new ML, no architectural change, no new API surface. New behavior limited to: the pre-loaded examples button on the UI. Everything else is documentation, screenshots, IAM hygiene, and dependency-hygiene wiring.

---

## 1. Goals and non-goals

### Goals
- README rewrite: hero, live demo link, screenshot, tech stack, architecture overview, local-dev quickstart, link to docs/.
- One real screenshot of the deployed UI showing a populated results panel.
- Pre-loaded demo content in the frontend: a small set of one-click example inputs that span sentiment / emotion combinations.
- Single performance-baseline doc consolidating numbers already measured in earlier phases (no new lab work).
- Cost-monitoring sanity check: confirm the $5/month AWS budget alert + SNS subscription set up in Phase 2 closeout (decision-log 2026-05-07 entry) is still active.
- Phase 5 carry-overs:
  - `backend/iam/github-actions-policy.json` reproducibility commit.
  - Phase 2 deviation #1 docs reconciliation (concurrency cap of 10 is stale per Phase 4 evidence).
  - `sentiment-admin` IAM access key deactivated after any remaining admin-tier work is done.
  - §8 Lambda resource-policy tightening **if** local CLI is upgradable to ≥ 2.30; otherwise re-defer with note.
- Dependency-update wiring: Dependabot for `npm` and `pip` (low-bar version of the Phase 5 §1 non-goal "Renovate / Dependabot wiring").

### Non-goals (deferred to Phase 7 or beyond)
- Bulk CSV upload — Phase 7's own thing.
- Custom domain — Phase 1 non-goal still standing.
- Provisioned concurrency / warm-up ping — only revisit if a recruiter walkthrough actually surfaces cold start as a blocker.
- Multi-environment deploys (staging vs. production) — Phase 5 non-goal.
- Real architecture diagram as a PNG/SVG asset — text-based ASCII / Mermaid is sufficient for portfolio.
- Real designed favicon — the Phase 4 1×1 empty-SVG suppressor is fine; redesign is a vanity item not worth the time budget.
- Sentry / Datadog / non-default observability — Phase 7+ or never.
- Internationalization, dark mode toggle, additional themes.
- New model evaluation, fine-tuning, or accuracy improvements.

If a "while we're in here" item appears, push back to `decision-log.md` first.

---

## 2. Order of operations

Sequence matters where one step's evidence depends on a prior step. Where dependencies are absent, the order is for batching / context-switching efficiency.

1. **Phase 2 deviation #1 reconciliation.** Cheapest item; just a markdown edit in `decision-log.md` (or a phase2-results.md note) updating the stale "account concurrency cap of 10" claim to reflect Phase 4 saturation evidence (~36 RPS sustained without throttling implies a higher cap). Frees the perf-baseline doc from having to call this out as ambiguous.
2. **`backend/iam/github-actions-policy.json` reproducibility commit.** Mirror the trust-policy commit pattern from Phase 5 §3.2. The JSON is already attached to the role as the `cicd-deploy` inline policy; we're just persisting it to the repo.
3. **§8 Lambda resource-policy tightening — gated check.** Verify current CLI version. If ≥ 2.30, run the two-statement evolve from Phase 5 plan §8 (add the `lambda:InvokedViaFunctionUrl`-conditioned grant first, smoke-test, remove the unconditional grant). If still < 2.30, re-defer to a future phase with an updated note in decision-log + record the CLI version observed.
4. **Performance-baseline doc.** New file `docs/performance-baseline.md` consolidating numbers from `phase2-results.md` (cold start, image size, memory) + `phase4-results.md` (warm p50/p95, retry timing) + `phase5-results.md` (deploy times). No fresh measurement; this is curation. Link out to source phase-results docs for raw evidence.
5. **Cost-monitoring sanity check.** Console-side: confirm the AWS Budgets entry for $5/month exists and the SNS subscription is `confirmed`. Record the observation (and the current month-to-date spend, if visible) in `phase6-results.md`. No code change unless something is misconfigured.
6. **Pre-loaded demo content.** Frontend change: a small set of curated example inputs (3–5 items) with a "Try an example" UI affordance. Lands via PR (pr-check gates it), merges to main, the existing `deploy-frontend` workflow republishes Pages. Verified live in Chrome.
7. **Screenshot.** Take a hard-refresh screenshot of the deployed UI with a pre-loaded example result populated. Commit under `docs/screenshots/` or similar. PNG, reasonable size (~200–600 KB).
8. **README rewrite.** Heavy. Goes after pre-loaded content + screenshot are live so the README can reference real artifacts. New sections (see §6 for detail).
9. **Dependabot.** Add `.github/dependabot.yml` for `npm` (frontend) and `pip` (backend `requirements.txt`). Weekly schedule, default config. Document in `phase6-results.md`. Closing the Phase 5 §1 non-goal officially.
10. **`sentiment-admin` access key deactivation.** Last of the admin-tier items. Once §8 either lands or is re-deferred and no more IAM admin work is needed for this phase, deactivate the access key in the AWS console.
11. **Phase 6 closeout.** Write `docs/phase6-results.md` per the established pattern. Append a decision-log entry. Tag `phase-6-complete`.

---

## 3. Phase 2 deviation #1 reconciliation

Phase 2 deviation #1 documents an AWS account-wide concurrency cap of 10. Phase 4 saturation evidence (Node 22 driver, 30 chains × 15 s, ~36 RPS sustained without throttling — see `phase4-results.md` deviation #2) implies AWS has since raised the quota. The Phase 4 entry flagged this as informational only; Phase 6 closes the loop.

Decision: do not run a fresh saturation test. Instead, add an addendum to the existing Phase 2 deviation #1 entry in `decision-log.md` linking forward to Phase 4 deviation #2 ("superseded by Phase 4 saturation evidence; account cap is no longer 10. Exact current value not measured because Phase 6 is polish, not capacity planning.").

Acceptance: a reader of `decision-log.md` starting from the Phase 2 entry can follow the chain to current state without confusion.

---

## 4. `backend/iam/github-actions-policy.json` reproducibility commit

Phase 5 §3.2 explicitly committed the trust policy. The inline `cicd-deploy` permissions policy was attached via CLI but not also written to the repo (Phase 5 deviation #5 in `phase5-results.md`).

The JSON to commit is the same one used at Phase 5 setup time:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    { "Sid": "EcrAuth", "Effect": "Allow", "Action": "ecr:GetAuthorizationToken", "Resource": "*" },
    { "Sid": "EcrPush", "Effect": "Allow", "Action": [
      "ecr:BatchCheckLayerAvailability", "ecr:InitiateLayerUpload", "ecr:UploadLayerPart",
      "ecr:CompleteLayerUpload", "ecr:PutImage", "ecr:BatchGetImage"
    ], "Resource": "arn:aws:ecr:us-east-1:323336951250:repository/sentiment-analyzer" },
    { "Sid": "LambdaDeploy", "Effect": "Allow", "Action": [
      "lambda:UpdateFunctionCode", "lambda:GetFunction"
    ], "Resource": "arn:aws:lambda:us-east-1:323336951250:function:sentiment-analyzer" }
  ]
}
```

Verify the committed file matches what's currently attached via `aws iam get-role-policy --role-name github-actions-cicd --policy-name cicd-deploy` before committing. PR-and-merge per the standard flow.

Acceptance: `backend/iam/github-actions-policy.json` exists in the repo and byte-matches the live inline policy on the role.

---

## 5. §8 Lambda resource-policy tightening — gated check

Phase 5 plan §8 deferred this on local CLI 2.27.20 < required 2.30. Phase 6 step:

1. Check current local AWS CLI: `aws --version`. If ≥ 2.30, proceed; if < 2.30, re-defer.
2. (If proceeding) Two-statement evolve to avoid denial window, per Phase 5 plan §8 verbatim:
   - Add the new URL-gated grant first (`lambda:InvokeFunction` + `--invoked-via-function-url`).
   - Smoke-test a real POST from the deployed UI — expect 200.
   - Only after smoke passes, remove the old unconditional `lambda:InvokeFunction` grant.
3. (If re-deferring) Add a fresh entry to `decision-log.md` noting the CLI version still observed + re-deferring to a future phase. Do not pretend this Phase 6 closes the item.

Acceptance: either the new statement is in place and the unconditional one is removed (with live POST evidence in `phase6-results.md`), or there's a fresh re-deferral entry with the observed CLI version. No silent ignore.

---

## 6. Performance-baseline doc

New file: `docs/performance-baseline.md`. Curation-only — pulls numbers from existing phase-results docs.

Required content:
- **Cold-start ladder.** First-ever cold start measured at 84.71 s (Phase 2, fresh ECR pool, >60 s of which is the image pull itself per `phase2-results.md`). Steady-state cold start on a warmed pool 5–10 s (Phase 2). Natural live cold starts observed during Phase 4 sat at 8.67 s (Safari) and 9.36 s (Chrome post-revert), both within the 30 s function timeout. Note Lambda's 30 s timeout means a first invocation after `update-function-code` (fresh image SHA, new host) can return 502 before init completes — Phase 5 retry-aware smoke handles this case exactly. Numbers between the first-ever and steady-state buckets (e.g., a re-provision onto a different host pool) are intentionally not stated as a single point — source docs don't.
- **Warm latency.** Phase 4 captures p50 / p95 (~1.5 s warm). Quote the row + link.
- **Throughput.** Phase 4 Node-driver saturation: ~36 RPS sustained, 429s engage above that. Reference Phase 4 deviation #2 + the Phase 2 deviation #1 reconciliation from §3.
- **Image size.** 1.85 GB per Phase 2; pinned model SHAs in the Dockerfile.
- **Memory.** 3008 MB (the account ceiling at Phase 2 deploy time).
- **Deploy times.** From `phase5-results.md`: ~33 s frontend deploy; ~9 min backend deploy end-to-end (including 76 s smoke with one retry).
- **Bundle size.** From `phase4-results.md`: 217.74 kB JS / 68.52 kB gzipped, 13.64 kB CSS / 3.36 kB gzipped, 0.60 kB HTML. (Hashes will drift; numbers are the point.)
- **Accuracy notes.** Sentiment 16/23 = 70% on the Phase 1 local validation set (per `phase-1-complete` tag message and `model-evaluation.md`). Emotion: no formal validation set; qualitative review only.

Tone is reference-doc, not narrative. Tables welcome.

Acceptance: the doc exists, links to source phase-results, doesn't introduce numbers that can't be cross-checked.

---

## 7. Cost-monitoring sanity check

Phase 2 closeout (decision-log 2026-05-07) confirms a $5/month AWS Budgets entry exists with a confirmed SNS subscription. Phase 6 acceptance is verifying nothing has lapsed:

1. `aws --profile sentiment-dev budgets describe-budgets --account-id 323336951250` (or whichever profile has `budgets:Describe*`; may need to widen sentiment-dev temporarily, or do it via root console). Record the budget name + `BudgetLimit`.
2. `aws sns list-subscriptions` against the budget's SNS topic ARN. Look for an `Endpoint` matching the maintainer's email + `SubscriptionArn` not equal to `PendingConfirmation`.
3. Note month-to-date spend if visible. Use a current-month-relative date range, e.g. on macOS:
   ```bash
   aws ce get-cost-and-usage \
     --time-period Start=$(date -u +%Y-%m-01),End=$(date -u -v+1m +%Y-%m-01) \
     --granularity MONTHLY --metrics UnblendedCost
   ```
   On GNU coreutils, swap to `$(date -u -d 'first day of next month' +%Y-%m-01)`. The hardcoded-month fallback is not acceptable — the check must reflect the actual month it's run in.

If anything looks lapsed (e.g., subscription unconfirmed), recreate or re-subscribe.

Acceptance: `phase6-results.md` records budget name, limit, subscription state, and month-to-date spend (or notes spend visibility issues).

---

## 8. Pre-loaded demo content

Frontend change. UI affordance: a small "Try an example" button or row above (or alongside) the text input. Clicking it fills the textarea with a curated example.

Curated examples (initial proposal, 3 items — codex can suggest different texts):
- Positive / joy: "I had the best meal of my life at this restaurant. The pasta was extraordinary and the staff treated us like family."
- Negative / anger: "Three weeks waiting for a refund and they keep transferring me between departments. Absolutely unacceptable service."
- Neutral / mixed: "The package arrived on time. Box was slightly damaged but the contents inside were fine."

Implementation constraints:
- No new state machine. The "Try an example" affordance writes into the existing controlled textarea state, then user clicks Submit (or it auto-submits — decide during impl).
- Examples stored as a module-level constant in `frontend/src/data/examples.ts` (or similar). Easy to extend.
- Component placement: above the TextInput, or as a small row of pill buttons. Decide during impl; codex review will catch if it clashes with existing layout.
- a11y: each example button has `aria-label` like "Load example: positive sentiment with joy emotion" so screen readers can navigate; focus moves to the textarea after click so keyboard users can immediately edit or submit.
- Tests: vitest unit for the example-loader logic (writes correct text into the textarea state) and one playwright e2e ("click example → see textarea filled → submit → see results"). Existing 113-test count rises to ~115.
- Bundle impact: small constant + small component. Should add < 2 kB gzipped.

Lands via PR `phase-6/demo-content` (or similar). `pr-check` runs on the PR; after merge, `deploy-frontend` republishes.

Acceptance — testable assertions:
- Live URL shows the affordance with each curated example reachable as its own button (count and labels match the source array in `frontend/src/data/examples.ts`).
- Clicking any example writes the exact source text into the textarea state (vitest unit test asserts `textarea.value === EXAMPLES[i].text`).
- Submitting an example returns a 200 with the documented envelope shape: `.sentiment.label` is one of `{positive, negative, neutral}`, `.emotions` is a non-empty object with all 7 keys (`anger, disgust, fear, joy, neutral, sadness, surprise`), `.keywords` is a non-empty array.
- For each example, the dominant predicted label matches a deliberately-coarse expected fixture (e.g., the "best meal of my life" example should resolve to `sentiment.label === 'positive'`). Model probabilities are not asserted — only the categorical winner — so the test isn't brittle to small probability shifts across model rebuilds.
- Playwright e2e: click first example button → assert textarea filled → submit → assert results panel appears.

---

## 9. Screenshot

After §8 lands, take a screenshot of the deployed UI in a clean state showing a populated results panel from one of the new examples.

Constraints:
- Chrome on macOS, default zoom, viewport ~1280 wide.
- Crop or compose so the screenshot includes: input area (with the example text visible), results panel (sentiment badge, emotion bars, keywords).
- File: `docs/screenshots/dashboard-hero.png`. Size target ~200–600 KB (no need for 4K; smaller loads faster on the README).
- One screenshot is enough. A second showing history is optional.

Commit + PR + merge per standard flow. No workflow runs on docs/, so this PR only triggers `pr-check` (which passes — no code change).

Acceptance: file exists, is referenced from the rewritten README's hero block.

---

## 10. README rewrite

The heaviest single deliverable. Replace the current root `README.md` with a portfolio-grade version. Target length: ~150–250 lines (longer than the current ~125-line draft, but not novel-length).

Target section structure:

1. **Title + one-line description.**
2. **Hero block:** the screenshot from §9 + a "Live demo: <URL>" line + a "Try it: <https://asdfghjklzxc123.github.io/Sentiment-Analyzer/>" link.
3. **What it does:** 2–3 sentences. Sentiment + emotion + keyword extraction on user-pasted English text, models run serverlessly on Lambda.
4. **Tech stack:** existing list, refreshed (status line removed — "Phase 2 complete" is stale).
5. **Architecture overview:** the ASCII diagram already in the README, plus 2–3 paragraphs explaining the request path, cold-start behavior at a high level, and where the persistence is (localStorage).
6. **Local development:** quickstart (clone + install + run). Pull from the current README's working sections (frontend + backend); trim what's not portfolio-relevant.
7. **Production build / deploy:** brief — point at CI/CD (the workflows under `.github/workflows/`).
8. **Performance:** one paragraph + a link to `docs/performance-baseline.md`.
9. **Decisions and tradeoffs:** one paragraph + a link to `docs/decision-log.md`. Surface 2–3 highest-signal decisions (e.g., the Lambda container approach, the OIDC auth, the no-API-Gateway choice) as bullets.
10. **Project status:** one line. Replace the "Phase 2 complete" / "Phase 5 will deploy" stale lines with "Live and deployed. Polished in Phase 6 (closed-with-deviation: ...).".
11. **License.** Unchanged.

Things to **remove** from the current README:
- "Status: Phase 2 complete" line.
- "Live demo: Placeholder" line.
- "Screenshot: Placeholder" line.
- "Roadmap: Current phase: Phase 3" line.

Things to **add**:
- The actual screenshot.
- A pinned `phase-5-complete` reference or link to the latest tag.
- The performance + decisions links.

Acceptance — concrete:
- Each section listed above (title, hero, what-it-does, tech stack, architecture, local dev, production / deploy, performance, decisions, project status, license) is present in the README in that order.
- Hero block contains the live URL link and the `docs/screenshots/dashboard-hero.png` reference; both are reachable (image renders, URL is HTTP 200).
- No "Phase N complete" / "Placeholder" / "Pending" strings remain anywhere in the README.
- Every external claim in the README (model names, function URL, pages URL, image size, bundle size) cross-checks against `docs/performance-baseline.md` or the relevant phase-results doc.
- The "Decisions and tradeoffs" section links to `docs/decision-log.md` and surfaces 2–3 specific bullets the reader can immediately follow.

---

## 11. Dependabot

Drop in `.github/dependabot.yml`. Default config, weekly:

```yaml
version: 2
updates:
  - package-ecosystem: "npm"
    directory: "/frontend"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
  - package-ecosystem: "pip"
    directory: "/backend"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule: { interval: "weekly" }
    open-pull-requests-limit: 5
```

Each Dependabot PR will run `pr-check` (no special trigger needed — it fires on `pull_request` against main). The Node 20-actions deprecation banner observed on Phase 5 backend deploy runs is exactly the kind of thing the `github-actions` ecosystem entry will surface PRs for; do not pre-bump those actions in Phase 6 — let Dependabot drive.

Acceptance: file committed; the first Dependabot scan run completes without configuration errors (visible under repo Insights → Dependency graph → Dependabot).

---

## 12. `sentiment-admin` access key deactivation

After §4 and §5 are done (those are the last admin-tier IAM operations of Phase 6), deactivate the `sentiment-admin` access key in the AWS console: IAM → Users → sentiment-admin → Security credentials → access key row → Make inactive.

Don't delete the user (keeping it makes re-activation cheap if a future phase needs admin again). Don't delete the access key (deletion is irreversible; deactivation is the right verb).

Local: leave the `sentiment-admin` profile in `~/.aws/credentials`. With the key deactivated, any CLI call under that profile will fail with `InvalidClientTokenId` — the failure is harmless and self-documenting.

Acceptance: `aws --profile sentiment-admin sts get-caller-identity` returns `InvalidClientTokenId`. Recorded in `phase6-results.md`.

---

## 13. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| README rewrite expands into "while we're in here" rewrites of phase docs | Medium | Phase docs are immutable historical records; only `decision-log.md` is living. README is allowed to summarize, not replace. |
| Pre-loaded examples change the existing state machine in a breaking way | Low | Examples must write into the existing controlled-textarea state path; no new state branches. Vitest covers the new path. |
| §8 CLI gate fails again, Phase 6 keeps deferring forever | Low | Spec explicitly allows re-deferral with an updated note. The point is to evidence "still 2.27, here's the new entry," not to force the change. |
| Dependabot opens a flood of PRs and overwhelms PR review | Low | `open-pull-requests-limit: 5` per ecosystem caps it. The maintainer can pause Dependabot from the GitHub UI if needed. |
| Screenshot reveals personal info (browser tabs, bookmarks bar) | Low | Take it in a fresh incognito window with no extensions, or crop tightly to the viewport. |
| Performance-baseline doc introduces numbers that contradict phase-results docs | Medium | No fresh measurement; only curate from existing phase-results docs. Link sources for every number. |
| Cost-monitoring check finds the subscription has lapsed | Low | If lapsed, re-subscribe. Mitigation is just doing the re-subscription, not preventing the lapse. |

---

## 14. Acceptance checklist

Before tagging `phase-6-complete`, every item below is true:

- [ ] `decision-log.md` Phase 2 deviation #1 reconciliation entry added.
- [ ] `backend/iam/github-actions-policy.json` exists in the repo and matches the live inline policy on the role.
- [ ] §8 Lambda resource-policy tightening either landed (with live POST evidence) or re-deferred with a fresh decision-log entry citing the current CLI version.
- [ ] `docs/performance-baseline.md` exists, links to source phase-results docs, contains no contradictions.
- [ ] Cost-monitoring sanity check recorded in `phase6-results.md`: budget name, limit, subscription state, optional month-to-date spend.
- [ ] Pre-loaded example affordance live on https://asdfghjklzxc123.github.io/Sentiment-Analyzer/; vitest covers the textarea-fill path; each example's expected dominant `sentiment.label` is asserted via a fixture (probabilities not asserted); playwright e2e covers click-fill-submit; envelope shape returned matches `{sentiment.label, emotions(7 keys), keywords}`.
- [ ] Screenshot committed at `docs/screenshots/dashboard-hero.png`.
- [ ] `README.md` rewritten per §10; screenshot referenced; placeholder lines removed; stale phase pointers replaced.
- [ ] `.github/dependabot.yml` committed; first scan runs without configuration errors.
- [ ] `sentiment-admin` access key deactivated; `aws --profile sentiment-admin sts get-caller-identity` returns `InvalidClientTokenId`.
- [ ] `docs/phase6-results.md` exists with all observations from this phase.
- [ ] `decision-log.md` updated with Phase 6 closeout entry.
- [ ] `pr-check` workflow (typecheck + lint + vitest + playwright + production build smoke) passes on the latest merge commit on `main`. The two unit + e2e tests added for the demo-content step are counted in.
- [ ] Tagged `phase-6-complete`.

---

## 15. Hand-off to Phase 7 (or end of v1)

Phase 6 closes the portfolio-readiness scope. After Phase 6, the v1 product is complete in the project-plan sense: live, polished, documented, monitored.

Phase 7 (bulk CSV upload) is **optional** per `project-plan.md`. Skip if scope or time becomes a concern. The v1 link Phase 6 produces stands on its own.

Open carry-overs to Phase 7 (or beyond):
- Phase 5 §8 if re-deferred again (CLI upgrade gating).
- Cold-start mitigation (provisioned concurrency or scheduled warm-up) — only if a recruiter walkthrough actually flags it.
- The Node 20-actions deprecation banner (June 2026 cutover) — let Dependabot drive once §11 lands.
- Real architecture diagram as a visual asset — if Phase 7 happens.
