# Phase 5: CI/CD with Git

**Status:** Pending start
**Prerequisites:** `phase-4-complete` tag (✓), deployed Function URL `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/` (✓), live Pages bundle at `https://asdfghjklzxc123.github.io/Sentiment-Analyzer/` (✓), 113 automated tests passing (✓), manual deploy path proven (`VITE_LAMBDA_URL=… npm run build && npx gh-pages -d dist` executed twice during Phase 4 — captured in `README.md` "Production build" section). ECR repo `323336951250.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer` and Lambda function `sentiment-analyzer` (region `us-east-1`) already created in Phase 2.
**Exit criteria:** Pushing to `main` triggers an automated GitHub Actions deploy that reaches the same final state as the manual flow — frontend bundle published to GitHub Pages, backend image rebuilt to ECR and Lambda updated when source changes warrant it. AWS auth runs entirely on OIDC (no long-lived AWS keys in repo secrets). PR checks run on every PR and gate merging. A post-deploy smoke test confirms the live Function URL still answers a 200 envelope after each backend deploy. Branch protection on `main` requires the PR checks to pass. Tag `phase-5-complete`.

Phase 5 is **packaging**, not architecture change. The deploy commands themselves are unchanged from Phase 4; the work is porting them to Actions yaml, authenticating with OIDC, and wiring branch protection. New product features still belong in `decision-log.md`.

---

## 1. Goals and non-goals

### Goals
- Frontend deploys on every push to `main` that touches `frontend/**`.
- Backend deploys on every push to `main` that touches `backend/**`.
- PR checks (typecheck, lint, vitest, playwright on the frontend) run on every PR against `main` and gate merge via branch protection.
- AWS authentication from Actions uses OIDC (`aws-actions/configure-aws-credentials@v4`), so no `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` secrets are ever stored in the repo.
- Post-deploy smoke test against the live Function URL after each backend deploy, with a clear pass/fail signal on the workflow run.
- The manual flow continues to work as a fallback (no hard cutover that locks the maintainer out of pushing emergency fixes).

### Non-goals (deferred)
- Multi-environment deploys (staging vs. production) — out of scope; one canonical environment is enough for a portfolio. Revisit in Phase 6+ only if a recruiter walkthrough surfaces a real need.
- Blue-green / canary deploys — Lambda's atomic image update is already gap-free for the warm path; cold starts after deploy are accepted (covered by Phase 4 §5 banner copy).
- Custom domain — Phase 1 non-goal.
- Provisioned concurrency or cold-start elimination — Phase 6.
- Observability / dashboards beyond CloudWatch defaults — Phase 6/7.
- Renovate / Dependabot wiring — Phase 6 polish.
- Caching ECR layers across runs beyond the default `docker/build-push-action` cache — not measurable until we see real build durations.
- Bulk CSV / Phase 7 features.

If a "while we're in here" item appears, push back to `decision-log.md` first.

---

## 2. Order of operations

This sequence matters: each step's evidence depends on the previous one. Do not reorder.

1. **Confirm baseline.** `phase-4-complete` tag present; `main` is at `091ece3` (or whatever the closeout commit is). From `frontend/`: typecheck, lint, vitest, playwright all pass. Manual `gh-pages -d dist` still works.
2. **AWS one-time setup** (§3). Create the GitHub OIDC identity provider in AWS IAM; create a CI role with a trust policy that limits assumption to this repo's `main` branch only (deploy-only — PR checks don't touch AWS); attach a least-privilege policy with `ecr:GetAuthorizationToken`, the per-repo ECR push perms, and `lambda:UpdateFunctionCode` + `lambda:GetFunction` on the `sentiment-analyzer` function only. Record the role ARN.
3. **PR check workflow** (§4). Add `.github/workflows/pr-check.yml` first — it doesn't deploy anything, so it's the safest workflow to land. Open a throwaway PR, watch typecheck/lint/vitest/playwright all pass on the runner.
4. **Frontend deploy workflow** (§5). Add `.github/workflows/deploy-frontend.yml`. Switch the GitHub Pages source from "branch: gh-pages" to "GitHub Actions" before merging (§5.3 below). Merge to `main` and watch the workflow build + deploy. Confirm the live URL still serves with the right `VITE_LAMBDA_URL` inlined.
5. **Backend deploy workflow** (§6). Add `.github/workflows/deploy-backend.yml`. Trigger via a deliberate backend touch (a comment-only change to a `.py` file is enough). Watch the workflow build the image, push to ECR, update Lambda, and run the smoke test.
6. **Branch protection** (§7). Once both deploy workflows are proven, enable required-checks on `main`. Adds friction; only enable after the workflows are verified green.
7. **Optional: tighten Lambda resource policy** (§8). Phase 2 deviation #5 left `lambda:InvokeFunction` granted without the `lambda:InvokedViaFunctionUrl` condition. The CLI now supports the flag; if the maintainer's CLI is current, add the condition. Otherwise defer to Phase 6.
8. **Tag `phase-5-complete`** after all 11 `phase5-cicd.md` §10 acceptance items are true.

---

## 3. AWS one-time setup (OIDC + IAM)

GitHub Actions can request a short-lived OIDC JWT from AWS via `aws-actions/configure-aws-credentials@v4`. The token's `sub` claim encodes the source repo / branch / workflow, so the trust policy can limit assumption to exactly this repo.

### 3.1 OIDC provider

```bash
aws iam create-open-id-connect-provider \
  --url https://token.actions.githubusercontent.com \
  --client-id-list sts.amazonaws.com \
  --thumbprint-list 6938fd4d98bab03faadb97b34396831e3780aea1
```

The thumbprint is GitHub's well-known cert thumbprint; AWS now ignores this field for `token.actions.githubusercontent.com` but the API still requires a non-empty value. Verify with `aws iam list-open-id-connect-providers`.

### 3.2 CI role + trust policy

Create `github-actions-cicd` for **deploy traffic only**. PR-check workflows do not need AWS (the PR check is typecheck + lint + vitest + playwright + a frontend build smoke; nothing in CI talks to AWS until merge to `main`). One role is enough; trust scoped tight.

Trust condition uses `StringEquals` on the exact `sub` claim, **not** `StringLike` with a wildcard. A wildcard like `repo:OWNER/REPO:*` would also accept tag pushes, environment workflows, and any branch — opening room for a misconfigured later workflow to elevate accidentally. Pin to `refs/heads/main`:

Trust policy (full JSON committed in `backend/iam/github-actions-trust.json` for reproducibility — created during this step):

```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": { "Federated": "arn:aws:iam::323336951250:oidc-provider/token.actions.githubusercontent.com" },
    "Action": "sts:AssumeRoleWithWebIdentity",
    "Condition": {
      "StringEquals": {
        "token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
        "token.actions.githubusercontent.com:sub": "repo:ASDFGHJKLZXC123/Sentiment-Analyzer:ref:refs/heads/main"
      }
    }
  }]
}
```

If a future need (e.g., Phase 6 staging environment) requires PR-time AWS access, add a **separate, no-deploy** role with its own trust policy keyed on `:pull_request` and `:environment:<name>`; do not widen this role.

### 3.3 Permissions policy

Attach a custom inline policy on the role with the minimum set:

- `ecr:GetAuthorizationToken` (resource: `*` — AWS requires it).
- `ecr:BatchCheckLayerAvailability`, `ecr:InitiateLayerUpload`, `ecr:UploadLayerPart`, `ecr:CompleteLayerUpload`, `ecr:PutImage`, `ecr:BatchGetImage` on `arn:aws:ecr:us-east-1:323336951250:repository/sentiment-analyzer`.
- `lambda:UpdateFunctionCode`, `lambda:GetFunction` on `arn:aws:lambda:us-east-1:323336951250:function:sentiment-analyzer`.

No `iam:*`, no broad `lambda:*`, no `s3:*`. Verify with `aws iam simulate-principal-policy` before relying on it in CI.

Record the role ARN — `arn:aws:iam::323336951250:role/github-actions-cicd` — as a **repository variable** (`vars.AWS_ROLE_ARN`), not a secret, because role ARNs are not sensitive on their own (the OIDC trust condition is the gate). Document in `phase5-results.md` once the workflows run cleanly.

---

## 4. PR check workflow

File: `.github/workflows/pr-check.yml`.

Triggers on `pull_request` against `main`. Runs from `frontend/`:

1. `actions/checkout@v4`.
2. `actions/setup-node@v4` pinned to Node 22 (matches `engines` in `package.json`).
3. `npm ci` — full clean install.
4. `npm run typecheck` — `tsc --noEmit`.
5. `npm run lint` — `eslint .`.
6. `npm test` — `vitest run` (108 tests).
7. `npx playwright install --with-deps chromium` then `npm run e2e` — 5 tests.
8. `VITE_LAMBDA_URL=https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/ npm run build` — production bundle smoke. Catches Vite-only failures (e.g., asset URL resolution under `base`, env-replacement breakage) that typecheck + vitest miss because they don't go through Vite's prod transformer.

A single job is acceptable; parallelization isn't worth the matrix overhead for 113 tests. The build step is intentionally last — if the cheaper checks above already failed, no point running it.

Backend Python checks are not part of PR check in Phase 5. Add only if Phase 6/7 introduces a Python test suite worth gating on.

Failure means the PR is not mergeable once §7 branch protection is on.

---

## 5. Frontend deploy workflow

### 5.1 Trigger

File: `.github/workflows/deploy-frontend.yml`. Triggers:

```yaml
on:
  push:
    branches: [main]
    paths: ['frontend/**', '.github/workflows/deploy-frontend.yml']
  workflow_dispatch: {}
```

The `workflow_dispatch` trigger keeps a "redeploy without a commit" escape hatch.

### 5.2 Job

Permissions block at the workflow level:

```yaml
permissions:
  id-token: write     # required by actions/deploy-pages@v4 to mint the Pages OIDC token
  contents: read
  pages: write
  deployments: write
```

Steps:
1. `actions/checkout@v4`.
2. `actions/setup-node@v4` (Node 22).
3. `npm ci` from `frontend/`.
4. `npm run build` with `env: { VITE_LAMBDA_URL: 'https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/' }`. The Function URL is public; checking it into the workflow is fine. If a future rotation moves to a CloudFront fronted hostname, switch to a repo variable.
5. `actions/upload-pages-artifact@v3` with `path: frontend/dist`.
6. `actions/deploy-pages@v4` — publishes to the Pages environment.

### 5.3 Pages source migration

Pages is currently configured (per Phase 4) with `source: branch=gh-pages, path=/`. Switching to `source: GitHub Actions` is required for `actions/deploy-pages` to work. Migration order matters:
- Land `.github/workflows/deploy-frontend.yml` in a PR. CI on the PR will skip the deploy step (it only triggers on `push: main`).
- **Before** merging the PR: change Pages settings to "GitHub Actions" in the repo settings UI (or via `gh api`). Document the click path in `phase5-results.md`.
- Merge the PR. The workflow runs and publishes. The old `gh-pages` branch is preserved as a fallback; can be deleted after Phase 5 closeout if the maintainer is comfortable.

The first Actions-driven deploy must reproduce the canonical bundle's behavior (same Function URL, same Vite base, same favicon SVG). Verify with `curl` for HTML + CSS + JS hashes, then a real browser hard-refresh.

---

## 6. Backend deploy workflow

File: `.github/workflows/deploy-backend.yml`. Triggers:

```yaml
on:
  push:
    branches: [main]
    paths: ['backend/**', '.github/workflows/deploy-backend.yml']
  workflow_dispatch: {}
```

Workflow-level permissions:

```yaml
permissions:
  id-token: write   # required for OIDC
  contents: read
```

Steps:
1. `actions/checkout@v4`.
2. `aws-actions/configure-aws-credentials@v4` with `role-to-assume: ${{ vars.AWS_ROLE_ARN }}` and `aws-region: us-east-1`.
3. `aws-actions/amazon-ecr-login@v2` — logs into ECR using the assumed role's `ecr:GetAuthorizationToken` perm.
4. `docker/setup-qemu-action@v3` — installs the QEMU emulator so GitHub's `ubuntu-latest` x86_64 runner can build a `linux/arm64` image. Required even when only one platform is targeted, because the build still cross-compiles.
5. `docker/setup-buildx-action@v3`.
6. `docker/build-push-action@v6` from `backend/` with `platforms: linux/arm64`, `push: true`, `provenance: false`, `sbom: false`, and `tags: 323336951250.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:${{ github.sha }}`. Also tag `:latest` for the manual fallback path. The `provenance: false` / `sbom: false` flags are mandatory per `decision-log.md` 2026-05-06 entry #6 — Lambda rejects buildkit OCI manifest lists with "The image manifest, config or layer media type for the source image ... is not supported"; only Docker v2 schema 2 manifests work.
7. `aws lambda update-function-code --function-name sentiment-analyzer --image-uri ...:${{ github.sha }}`.
8. `aws lambda wait function-updated-v2 --function-name sentiment-analyzer` — blocks until the function is ready to invoke with the new image.
9. **Smoke test** — see §6.1.

### 6.1 Smoke test

After `function-updated-v2`, run:

```bash
RESP=$(curl -sS -o /tmp/resp.json -w "%{http_code}" \
  -X POST 'https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/' \
  -H 'content-type: application/json' \
  -d '{"text":"smoke test from CI"}' \
  --max-time 90)
[ "$RESP" = "200" ] || { echo "smoke status $RESP"; cat /tmp/resp.json; exit 1; }
jq -e '.sentiment.label and .emotions and .keywords' /tmp/resp.json
```

Acceptance: HTTP 200 and the response has `sentiment.label`, `emotions`, and `keywords` keys.

Cold-start risk: the first invocation after `update-function-code` is a cold start, and re-provisioning on a fresh ECR host can exceed 60 s. Options:
- **(a)** Use `--max-time 90` to widen the curl timeout above the worst observed cold start (~85 s in Phase 2 results). Acceptable for a one-shot smoke; never use in a user-facing client.
- **(b)** First call expected to fail (warm-up), then run the real assertion on the second call. Slightly more lines, hides intermittent real failures.

Pick **(a)**. Phase 6 can revisit if cold-start hardening lands.

---

## 7. Branch protection on `main`

Enable after both deploy workflows are proven on at least one merge each:

- Require pull request reviews before merging — for a solo project, set "Allow specified actors to bypass" to the maintainer if review-by-self is impractical, otherwise approve via the GitHub UI's self-PR pattern.
- Require status checks to pass — name the PR check workflow's jobs (typically `pr-check` once the workflow lands).
- Require branches to be up to date before merging.
- Do not allow force pushes to `main`.
- Do not allow deletions on `main`.

Enabling this before the workflows are green will lock the maintainer out of merging. Verify each workflow runs cleanly first, then turn protection on.

---

## 8. Optional: tighten Lambda resource policy

Per `decision-log.md` 2026-05-06 entry #5, the deployed function's resource policy currently has **two** statements granting public access:

1. `lambda:InvokeFunctionUrl` with `--function-url-auth-type NONE` — the public-URL grant.
2. `lambda:InvokeFunction` with no condition — the broader grant AWS added in October 2025; without it, the URL returns 403 even with statement #1 in place.

The second statement is what's loose: it currently lets *anyone with the function ARN* call `Invoke` directly, not just URL traffic. The tightening adds a `lambda:InvokedViaFunctionUrl: true` condition to statement #2 while keeping statement #1 intact.

```bash
# Statement #1 (recreate if missing — kept open as the URL-side grant):
aws lambda add-permission \
  --function-name sentiment-analyzer \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal '*' \
  --function-url-auth-type NONE

# Statement #2 — add the URL-gated replacement FIRST (no denial window):
aws lambda add-permission \
  --function-name sentiment-analyzer \
  --statement-id FunctionURLAllowPublicInvokeViaUrl \
  --action lambda:InvokeFunction \
  --principal '*' \
  --invoked-via-function-url

# Smoke-test from the deployed UI: confirm a real POST still returns 200.
# Only after the new statement is verified, remove the old unconditional one:
aws lambda remove-permission \
  --function-name sentiment-analyzer \
  --statement-id FunctionURLAllowPublicInvoke
```

The two `lambda add-permission` calls produce two separate statements; AWS evaluates them as a union, so during the window between the new `add` and the old `remove`, both grants are active and the function still responds. The `--invoked-via-function-url` flag requires AWS CLI 2.30+ (per AWS release notes); local CLI was 2.27 during Phase 2, so re-check version before running. If the flag still isn't accepted, defer again to Phase 6 with the same note.

---

## 9. Risk register

| Risk | Likelihood | Mitigation |
|---|---|---|
| OIDC trust policy mis-scoped → CI can assume role from a fork, unrelated repo, or unintended branch/tag | Low | `StringEquals` condition pins the full `sub` to `repo:ASDFGHJKLZXC123/Sentiment-Analyzer:ref:refs/heads/main` exactly (not `StringLike`, no wildcard); verify via `aws iam simulate-custom-policy` with a forged `sub` claim before going live |
| Branch protection enabled before workflows green → maintainer locked out | Medium | Order of operations: enable protection in step 6, after both deploys verified |
| Pages source switch breaks the live URL during the migration window | Low–medium | Old `gh-pages` branch stays; can revert in repo settings; verify hard-refresh + curl right after the first Actions-driven deploy |
| Backend smoke times out on a re-provisioned cold start | Medium | `--max-time 90` per §6.1; documented acceptance is that ~5 minutes after a fresh image pull, the warm path returns in ~1.5 s |
| ECR push from CI fails because the OIDC role doesn't have the right ECR perm | Medium | `aws iam simulate-principal-policy --action-names ecr:PutImage` against the role before merging the workflow |
| Image build time exceeds Actions free-tier ARM runner minutes | Low | The Phase 2 build was ~3 minutes; well under the per-job cap. If it grows, switch to `docker/build-push-action`'s GHA cache backend |
| `VITE_LAMBDA_URL` ever needs to be different per environment | Low | Out of scope (Phase 5 non-goal: multi-env). Hardcoded in workflow yaml; move to repo variable if the constraint changes |
| Maintainer pushes a hotfix directly to `main` to bypass CI | Low | Branch protection blocks; documented escape hatch is `workflow_dispatch` to re-trigger the manual deploy path |

---

## 10. Acceptance checklist

Before tagging `phase-5-complete`, every item below is true:

- [ ] AWS OIDC provider + `github-actions-cicd` role created with least-privilege policy. Role ARN recorded in `vars.AWS_ROLE_ARN` repo variable.
- [ ] `.github/workflows/pr-check.yml` exists; PR check runs typecheck + lint + vitest + playwright, all green on at least one PR.
- [ ] `.github/workflows/deploy-frontend.yml` exists; a frontend-only change merged to `main` produced a live Pages update via Actions; hard-refresh in Chrome and Safari confirms the new bundle.
- [ ] GitHub Pages source migrated to "GitHub Actions" (no longer the `gh-pages` branch).
- [ ] `.github/workflows/deploy-backend.yml` exists; a backend-only change merged to `main` produced a new image in ECR (tag matches the commit SHA) and the Lambda's `Code.ImageUri` was updated.
- [ ] Backend smoke test passed end-to-end on at least one CI-driven deploy: HTTP 200 + the response carries `sentiment.label`, `emotions`, `keywords`.
- [ ] Branch protection on `main` requires PR check, blocks force pushes, blocks deletion.
- [ ] `docs/phase5-results.md` exists with: workflow run URLs (PR + frontend deploy + backend deploy), the role ARN, observed deploy times, and any deviations.
- [ ] `decision-log.md` updated for any spec deviations (e.g., if the optional §8 resource-policy tightening was applied or deferred again).
- [ ] All Phase 4 automated tests still pass.
- [ ] Tagged `phase-5-complete`.

---

## 11. Hand-off to Phase 6

Phase 6 inherits a fully automated deploy pipeline. Pushing to `main` produces an updated frontend bundle and/or backend image without manual `npm run build`, `gh-pages`, or `aws lambda update-function-code` invocations.

Phase 6 owns (per `project-plan.md` §Phase 6):
- Comprehensive `README.md` with screenshots and architecture overview (the current root README is functional but pre-portfolio).
- Pre-loaded demo content / one-click examples.
- Performance baseline documentation pulled together from `phase2-results.md` and `phase4-results.md`.
- Cost monitoring confirmation against the Phase 1 billing alert.
- Optionally: cold-start mitigation (provisioned concurrency or warm-up ping) if a recruiter walkthrough surfaces it.

Open follow-ups carried in from earlier phases that Phase 5 does not absorb:
- Phase 2 deviation #1 ("account concurrency cap = 10") is stale per Phase 4 saturation evidence; reconcile during Phase 6 polish.
- History-list polish (already shipped post-Phase-4 in commit `399e85e`); no further work pending.
- `kind:'parse'`, `kind:'server'`, `kind:'throttled'` non-reproducibles documented in `phase4-results.md` with unit-test references — Phase 6 does not need to re-litigate.
