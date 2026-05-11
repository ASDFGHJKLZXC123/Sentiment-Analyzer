# Phase 5 Results

Closeout record for `docs/phase5-cicd.md`. Captured 2026-05-10 across the four PRs that landed the CI/CD pipeline.

## Live URLs (unchanged from Phase 4)

- Frontend (now Actions-deployed): https://asdfghjklzxc123.github.io/Sentiment-Analyzer/
- Backend Function URL: https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/

## AWS one-time setup (§3)

| Item | Value |
|---|---|
| OIDC provider | `arn:aws:iam::323336951250:oidc-provider/token.actions.githubusercontent.com` |
| CI role ARN | `arn:aws:iam::323336951250:role/github-actions-cicd` |
| Trust policy | `backend/iam/github-actions-trust.json`; `StringEquals` on `sub = repo:ASDFGHJKLZXC123/Sentiment-Analyzer:ref:refs/heads/main` (no wildcards) |
| Inline policy | `cicd-deploy` (not committed): `ecr:GetAuthorizationToken` on `*`, six ECR-push actions on `repository/sentiment-analyzer`, `lambda:UpdateFunctionCode` + `lambda:GetFunction` on `function:sentiment-analyzer` |
| Repo variable | `vars.AWS_ROLE_ARN` = the role ARN above |
| Admin path used | New `sentiment-admin` IAM user (`AdministratorAccess`) created via root console, CLI profile `sentiment-admin` for the OIDC + role setup, can be deactivated post-phase |

`aws iam simulate-principal-policy` against the role with all 9 action names returned `allowed` (the `ecr:GetAuthorizationToken` row only allows resource `*`, which the simulator confirms once resource ARNs are dropped from the call).

## PRs (rebase-and-merge into `main`)

| PR | Subject | Workflow run on PR | Result |
|---|---|---|---|
| [#1](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/pull/1) | Phase 5 §4: add pr-check workflow | [run 25642259387](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25642259387) | 75 s, SUCCESS |
| [#2](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/pull/2) | Phase 5 §5: add deploy-frontend workflow | [run 25642977042](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25642977042) | 67 s, SUCCESS |
| [#3](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/pull/3) | Phase 5 §6 + §3: add deploy-backend workflow + OIDC trust policy | [run 25643754634](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25643754634) | 70 s, SUCCESS |
| [#4](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/pull/4) | Phase 5 §6.1: smoke test bounded retries | [run 25644535212](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644535212) | 58 s, SUCCESS |

Rebase-and-merge was picked over squash on codex's recommendation: each PR was already one curated commit, rebase preserves messages verbatim, and the project's history is already linear.

## Pages source migration (§5.3)

Before merging PR #2 the Pages source was flipped from legacy branch (`gh-pages` at `/`) to GitHub Actions, via `gh api -X PUT /repos/ASDFGHJKLZXC123/Sentiment-Analyzer/pages -F build_type=workflow`. Equivalent UI click-path: repo **Settings → Pages → Build and deployment → Source dropdown → GitHub Actions**.

The old `gh-pages` branch is preserved as a documented fallback per §5.3; can be deleted whenever the new pipeline is judged solid.

## Frontend deploy (§5)

| Item | Value |
|---|---|
| Run | [25643731343](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25643731343) |
| Trigger | `push: main` (path: `frontend/**` filter caught via the workflow file itself on first run) |
| Duration | 33 s end-to-end |
| Bundle | `assets/index-DXzPIoXd.js`, `assets/index-CKNGMwmg.css` — hashes differ from Phase 4's canonical `index-CoWO73-n.js / index-wO-tLMzg.css` because this is a fresh build; content shape unchanged |

Verified via `curl`: HTML 200, JS 200, CSS 200, `VITE_LAMBDA_URL` correctly inlined as the canonical Function URL, asset paths under `/Sentiment-Analyzer/`. Browser hard-refresh in Chrome + Safari pending (recommended before the tag).

## Backend deploy (§6)

Two runs in total. First-run failure details captured under Deviations §1; the post-PR-#4 re-run is the canonical evidence below.

| Item | Value |
|---|---|
| Run | [25644688218](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644688218) |
| Trigger | `push: main` (workflow file changed in PR #4 → path filter matched) |
| Duration | 9m7s end-to-end (build + push + Lambda update + smoke with one retry) |
| Image tag pushed | `323336951250.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:f55ad509cac42497aa31c9042adbbfffde39deea` (also `:latest`); matches the PR #4 merge SHA `f55ad50` |
| Lambda `Code.ImageUri` | `…/sentiment-analyzer:f55ad509cac42497aa31c9042adbbfffde39deea` — verified via `aws lambda get-function --query Code.ImageUri` |
| Smoke result | Attempt 1: HTTP 502 in ~41 s (same Phase 2 deviation #7 cold-init-past-30 s failure as run #1). 15 s sleep. Attempt 2: HTTP 200 in ~35 s; `jq -e .sentiment.label and .emotions and .keywords` → `true`. Smoke step total: 76 s. |

The retry path is now exercised end-to-end in production CI, with both the failing first attempt and the recovering second attempt captured in the run log — exactly the behavior plan §6.1's now-superseded option (a) couldn't produce.

## Deviations from `docs/phase5-cicd.md`

1. **§6.1 smoke test switched from option (a) to a bounded variant of option (b).** First `deploy-backend` run ([25644219764](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644219764)) failed at the smoke step with HTTP 502 in ~40 s. Root cause was Phase 2 deviation #7 reappearing: the first invocation after `update-function-code` lands on a Lambda host that hasn't cached the new image SHA yet, image pull + cold init exceeds the function's **30 s timeout**, AWS returns 502 fast — well before curl's `--max-time 90` could engage, because the function (not the connection) is the bottleneck. Plan §6.1 picked option (a) on the implicit assumption that curl's timeout was the cap; that's only true when the function eventually responds. PR #4 switched the smoke step to **up to 3 attempts with 15 s sleep between failures**. The image gets cached on the host on every attempt regardless of 200 vs. timeout-kill, so retry #2 generally falls inside the 30 s timeout (warm init ~10 s). All 3 failing signals a genuinely broken image, not cold-start flake — the plan's stated concern with option (b) ("hides intermittent real failures") is bounded by the cap.

2. **§8 Lambda resource policy tightening deferred to Phase 6, again.** Plan §8 made it conditional on local CLI ≥ 2.30 (which supports `--invoked-via-function-url`). Local CLI is **2.27.20**, so the optional tightening is deferred per the plan's own fallback clause. Phase 6 should pick this up if/when the CLI is upgraded. The current loose `lambda:InvokeFunction` grant is functionally permissive but not exploitable from the public internet without the function ARN (per Phase 2 deviation #5).

3. **Permissions policy not committed alongside the trust policy.** Plan §3 explicitly says to commit `backend/iam/github-actions-trust.json` for reproducibility; the inline `cicd-deploy` permissions policy was attached via CLI but not also committed. Captured here for parity. Phase 6 polish could add `backend/iam/github-actions-policy.json` if a reproducible bring-up matters.

4. _Resolved._ Frontend browser-refresh verification done in Chrome + Safari (Cmd+Shift+R + a real submit cycle) right before this commit; §10 item 3 flipped to `[x]`. Kept in the deviations list as a process note (curl alone wasn't enough for the §10 wording's intent).

## §10 Acceptance checklist

- [x] AWS OIDC provider + `github-actions-cicd` role created with least-privilege policy. Role ARN in `vars.AWS_ROLE_ARN`.
- [x] `.github/workflows/pr-check.yml` exists; PR check runs typecheck + lint + vitest + playwright, all green on at least one PR (verified on #1, #2, #3, #4).
- [x] `.github/workflows/deploy-frontend.yml` exists; a frontend-only change merged to `main` produced a live Pages update via Actions. Verified end-to-end: `curl` confirmed HTML / JS / CSS all 200 with `VITE_LAMBDA_URL` inlined; Chrome + Safari hard-refresh confirmed assets load and a submit returns results in both browsers.
- [x] GitHub Pages source migrated to "GitHub Actions" (no longer the `gh-pages` branch).
- [x] `.github/workflows/deploy-backend.yml` exists; a backend-only change merged to `main` produced a new image in ECR (SHA-tagged `f55ad50…`) and Lambda's `Code.ImageUri` was updated to that SHA.
- [x] Backend smoke test passed end-to-end on at least one CI-driven deploy (run [25644688218](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644688218): attempt 1 502 → 15 s sleep → attempt 2 200 + jq pass).
- [x] Branch protection on `main` requires PR check (`pr-check` context), required PR review (1 approval, `enforce_admins: false` so the solo maintainer can still self-merge), strict up-to-date branch required, force pushes blocked, deletions blocked. Applied via `gh api -X PUT /repos/.../branches/main/protection`.
- [x] `docs/phase5-results.md` exists with: workflow run URLs (PR + frontend deploy + backend deploy), the role ARN, observed deploy times, and any deviations. _(This doc; backend-deploy run row gets filled in shortly.)_
- [x] `decision-log.md` updated for any spec deviations. Entry appended in this commit (`## 2026-05-10 — Phase 5 closeout: CI/CD pipeline landed in four PRs`).
- [x] All Phase 4 automated tests still pass (pr-check ran them on each of #1–#4 against the head branch).
- [ ] Tagged `phase-5-complete`.

## Hand-off to Phase 6

Phase 5 hands off a fully automated deploy pipeline:
- Push to `main` touching `frontend/**` → Pages republish in ~30 s, no manual `gh-pages` push.
- Push to `main` touching `backend/**` → ECR build + push + Lambda update + retry-aware smoke (verified live: attempt 1 → 502, attempt 2 → 200).
- `pr-check` (typecheck + lint + vitest + playwright + production build smoke) gates every PR; branch protection on `main` requires it.
- AWS auth is OIDC; no long-lived keys in the repo. Trust policy committed for reproducibility.

Open carry-overs:
- §8 Lambda resource policy tightening (depends on CLI upgrade).
- `backend/iam/github-actions-policy.json` reproducibility commit (cosmetic).
- Phase 2 deviation #1 docs reconciliation (concurrency cap of 10 is stale per Phase 4 evidence).
- `gh-pages` branch can be deleted now that the new pipeline is canonical.
