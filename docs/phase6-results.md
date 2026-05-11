# Phase 6 Results

Closeout record for `docs/phase6-cicd.md`. Captured 2026-05-10 onward; this file grows section-by-section as each Phase 6 step lands, and is finalized at the `phase-6-complete` tag commit.

> **Phase status while this doc is being written:** §3 (concurrency reconciliation), §4 (policy commit), §5 (Lambda tightening re-deferred), §6 (perf baseline doc), §7 (cost-monitoring check) have landed or are landing. §8 (pre-loaded examples) onward not yet started.

## Live URLs (unchanged from Phase 5)

- Frontend: https://asdfghjklzxc123.github.io/Sentiment-Analyzer/
- Backend Function URL: https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/

## §3 Phase 2 concurrency-cap reconciliation

Decision-log entry appended: `2026-05-10 — Phase 6 §3: Phase 2 concurrency-cap deviation reconciled`. Phase 4 saturation evidence (Node 22 driver, 30 chains × 15 s, sustained ~36 RPS) supersedes the Phase 2 "account quota = 10" claim. No fresh measurement; no infra change.

## §4 `cicd-deploy` policy committed

`backend/iam/github-actions-policy.json` lands as a byte-equivalent copy of the live inline policy on `arn:aws:iam::323336951250:role/github-actions-cicd` (`jq -S` canonical-form diff is empty). Closes Phase 5 deviation #5.

## §5 Lambda resource-policy tightening — re-deferred

Decision-log entry appended: `2026-05-10 — Phase 6 §5`. Local AWS CLI is `aws-cli/2.27.20`; the `--invoked-via-function-url` flag still needs ≥ 2.30. Per the plan's gated-fallback path, re-deferred with the current CLI version recorded.

## §6 Performance baseline doc

`docs/performance-baseline.md` lands as a curation-only doc — every number links back to its source phase-results doc. Cold-start ladder, warm latency, throughput, image + bundle sizing, deploy times (Phase 5 pipeline), and accuracy notes are all consolidated; no fresh measurement.

## §7 Cost-monitoring sanity check

Findings as of 2026-05-10 / 2026-05-11 (run under the `sentiment-admin` profile, region `us-east-1`):

| Artifact | State | Source/ARN |
|---|---|---|
| AWS Budgets entry | **None** — `aws budgets describe-budgets --account-id 323336951250` returns 0 budgets | Phase 2 closeout's "$5/month budget" was informally named; the real artifact is a CloudWatch billing alarm, not a Budgets entry. Clarified here. |
| CloudWatch billing alarm | **Active**, threshold $5.00, currently `OK` | `arn:aws:cloudwatch:us-east-1:323336951250:alarm:AWS-Billing-5USD`; metric `EstimatedCharges` / `AWS/Billing`; created 2026-05-06, last evaluated 2026-05-07 |
| SNS topic | **Exists** | `arn:aws:sns:us-east-1:323336951250:aws-billing-alerts` |
| SNS subscription on the topic (at check time) | **0 subscriptions** — lapsed since Phase 2 closeout | `aws sns list-subscriptions-by-topic --topic-arn ...` returned an empty list |
| Resubscribe action taken | `aws sns subscribe --protocol email --notification-endpoint yonghuz1@uci.edu` returned `"SubscriptionArn": "pending confirmation"` | Awaiting maintainer's email-link click in the AWS confirmation email |
| Month-to-date spend | `$0.0000000192` (effectively zero; free tier absorbing Lambda traffic) | `aws ce get-cost-and-usage --time-period Start=$(date -u +%Y-%m-01),End=$(date -u -v+1m +%Y-%m-01) --granularity MONTHLY --metrics UnblendedCost` |

**Subscription confirmation status:** PENDING at the time of this commit. Flips to `Confirmed` once the maintainer clicks the link in the AWS-sent email; verifiable via `aws sns list-subscriptions-by-topic --topic-arn arn:aws:sns:us-east-1:323336951250:aws-billing-alerts --query 'Subscriptions[].SubscriptionArn' --output text` (should return a real ARN, not `PendingConfirmation`). Update this line at confirmation.

**Why the Phase 2 entry framing was loose:** The 2026-05-07 decision-log "billing alert + SNS subscription — done" entry used "$5/month AWS budget" loosely. The real shipping mechanism is the CloudWatch billing alarm + SNS topic combination (which is cheaper than AWS Budgets and doesn't add its own monthly Budgets fee). No behavior change is implied by the clarification — the alarm has been correctly configured since Phase 2 — only that the maintainer should look for `AWS-Billing-5USD` (not a budget) if they go looking in the console.

## §8–§12

To be filled in as each step lands.

## §14 Acceptance checklist (working copy)

- [x] `decision-log.md` Phase 2 deviation #1 reconciliation entry added (§3).
- [x] `backend/iam/github-actions-policy.json` exists and matches live inline policy (§4).
- [x] §8 Lambda resource-policy tightening re-deferred with fresh decision-log entry citing CLI 2.27.20 (§5).
- [x] `docs/performance-baseline.md` exists, links to source phase-results docs, no contradictions (§6).
- [ ] Cost-monitoring sanity check recorded (§7): partially done — alarm + topic verified, resubscribe sent, **awaiting maintainer's email confirmation click before this checkbox flips**.
- [ ] Pre-loaded example affordance live on the deployed URL (§8).
- [ ] Screenshot committed at `docs/screenshots/dashboard-hero.png` (§9).
- [ ] `README.md` rewritten per §10.
- [ ] `.github/dependabot.yml` committed; first scan runs without configuration errors (§11).
- [ ] `sentiment-admin` access key deactivated (§12).
- [ ] `docs/phase6-results.md` exists with all observations (this doc).
- [ ] `decision-log.md` Phase 6 closeout entry appended.
- [ ] `pr-check` workflow passes on the latest merge commit on `main`.
- [ ] Tagged `phase-6-complete`.

## Hand-off to Phase 7

Deferred until closeout. Will land when items 7–14 of the §14 checklist above are checked.
