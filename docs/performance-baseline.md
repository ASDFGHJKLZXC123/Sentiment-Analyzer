# Performance baseline

Curation of measurements already recorded in earlier phase-results docs. **No fresh measurement** lives in this file; every number here links back to the phase doc that owns the raw evidence. If a number ages, the source doc is what gets updated and the link still points at the truth.

Scope: the deployed stack at the end of Phase 5 — `cardiffnlp/twitter-roberta-base-sentiment-latest` + `j-hartmann/emotion-english-distilroberta-base` + YAKE, running as a Python 3.13 ARM64 container image on AWS Lambda (`us-east-1`, 3008 MB), fronted by a Function URL (`auth-type=NONE`, CORS allow-list locked to the canonical Pages origin), with a Vite + React 19 frontend hosted on GitHub Pages.

---

## Cold-start ladder

| Bucket | Duration | Source |
|---|---|---|
| First-ever invocation (fresh ECR pool, no host has the image) | **~85 s** (`84.71 s` measured) — `>60 s` of which is the ECR image pull itself | `phase2-results.md` "Cold-start nuance" + decision-log 2026-05-06 deviation #7 |
| Steady-state cold start at 3008 MB on a warmed pool | 5–8 s expected; 5–10 s observed | `phase2-results.md` "Cold-start nuance" |
| Natural live cold starts (Phase 4 deployed bundle) | 8.67 s (Safari), 9.36 s (Chrome post-revert) | `phase4-results.md` browser matrix + §5 ladder confirmation |
| First invocation after `update-function-code` (CI's smoke step) | Times out at the function's **30 s** timeout when the Lambda host doesn't yet have the new image SHA cached; returns 502 fast. CI's retry-aware smoke sleeps 15 s and re-invokes, which lands inside the timeout. | `phase5-results.md` Backend deploy + Deviation #1 |

The 30 s function timeout is set by Phase 2; the first-ever cold start exceeds it. This is acceptable for portfolio scope (re-evaluate per `phase6-polish.md` non-goals only if a recruiter walkthrough surfaces it).

---

## Warm-path latency

| Metric | Value | Source |
|---|---|---|
| Warm p95 (Function URL round-trip from a US laptop) | 1,568 ms | `phase2-results.md` "Warm-Path Measurements" |
| Pure inference time inside the handler (post-warmup) | 600–900 ms | `phase2-results.md` "Choice for production" |
| Warm-path budget per spec | < 800 ms inference (network excluded) | `phase2-results.md` framing |

Network overhead between the local laptop and `us-east-1` accounts for the gap between the in-handler timing and the round-trip measurement (~300–500 ms). Within the budget once that overhead is subtracted.

---

## Throughput

| Driver | Observation | Source |
|---|---|---|
| Node 22 native fetch, 30 concurrent chains, 15 s window | 548 × 200 + 2780 × 429 = **~36 RPS sustained** before AWS engaged 429 throttling | `phase4-results.md` deviation #1 + #2 |
| Browser-driven saturation from Pages origin | Browser self-throttled (per-origin fetch concurrency cap) before AWS quota engaged; only 200s observed | `phase4-results.md` deviation #1 |
| Account-wide concurrency cap | Higher than 10 (Phase 4 evidence supersedes the original Phase 2 measurement); exact value not pinned | `decision-log.md` 2026-05-10 "Phase 6 §3" entry |

---

## Bundle and image

| Artifact | Size | Source |
|---|---|---|
| Lambda container image | 1.85 GB on disk; pinned model SHAs at build time | `phase2-results.md` "Image Sizing" + Dockerfile `ENV ...REVISION=` lines |
| Lambda memory | 3008 MB (account ceiling) | `phase2-results.md` deviation #3 + decision-log 2026-05-06 entry item 3 |
| Frontend JS bundle (canonical Phase 4 build) | `index-CoWO73-n.js`: 217.74 kB raw / 68.52 kB gzipped | `phase4-results.md` "Live URL" |
| Frontend CSS bundle | `index-wO-tLMzg.css`: 13.64 kB raw / 3.36 kB gzipped | `phase4-results.md` "Live URL" |
| Frontend HTML entry | 0.60 kB | `phase4-results.md` "Live URL" |
| Frontend module count | 47 (post-Phase-4 cleanup of legacy `.jsx` files) | `decision-log.md` 2026-05-09 "Phase 4 §7 audit" |

Hashes drift on each build; sizes don't unless code changes. The Phase 5 Actions-driven build produced different hashes (`index-DXzPIoXd.js / index-CKNGMwmg.css`) but the same approximate sizes — fresh-build artifact identity, not content drift.

---

## Deploy times (Phase 5 pipeline)

| Workflow | Duration | Source |
|---|---|---|
| `pr-check` (typecheck + lint + 108 vitest + 5 playwright + production build smoke) | 58–75 s per run across PRs #1–#4 | `phase5-results.md` PR table |
| `deploy-frontend` (npm ci + build + upload-pages-artifact + deploy-pages) | 33 s end-to-end | `phase5-results.md` Frontend deploy |
| `deploy-backend` (buildx + ECR push + Lambda update + smoke with retry) | 9m7s end-to-end on the canonical post-PR-#4 run | `phase5-results.md` Backend deploy |
| `deploy-backend` smoke step (attempt 1 502 → 15 s sleep → attempt 2 200) | 76 s | `phase5-results.md` Backend deploy + Deviation #1 |

---

## Accuracy notes

| Model task | Validation result | Source |
|---|---|---|
| Sentiment (RoBERTa Twitter) | 16/23 = **70%** on the Phase 1 local English test corpus; all sarcastic and mixed cases failed (as expected by spec); clear positive / negative / neutral / negation / internet-shorthand cases at 100% | `model-evaluation.md` + `phase-1-complete` tag message |
| Emotion (DistilRoBERTa) | No formal validation set; qualitative review only on Phase 1 corpus | `phase1-foundation.md` Section E framing |
| Keyword extraction (YAKE) | Statistical, non-ML; no accuracy number applies; behavior asserted by integration tests | `decision-log.md` Phase 1 stack entry + `model-evaluation.md` |

The sentiment number is the only quantitative accuracy measurement for v1. Improving it (or producing comparable numbers for emotion) is out of Phase 6 scope and out of `project-plan.md` Phase 7 scope; would belong to a hypothetical Phase 8 if the portfolio ever needs it.

---

## What's intentionally not in this doc

- **Account-wide concurrency cap, exact current value.** Phase 4 saturation showed > 10; Phase 6 §3 reconciled the discrepancy with Phase 2's "10" claim. The exact number isn't pinned because Phase 6 is polish, not capacity planning.
- **Cost numbers.** Belong in the cost-monitoring sanity check section of `phase6-results.md`, not here.
- **Provisioned-concurrency comparisons.** Phase 6 non-goal; revisit only if recruiter walkthrough flags cold start as a blocker.
- **Per-region latency.** Single-region deployment (`us-east-1`); not comparing.
