# Decision Log

A running log of architectural decisions, scope changes, and revisions. Entries are append-only; never edit past entries, only add new ones explaining changes.

---

## 2026-05-04 — Phase 1 foundation document, v1

Initial Phase 1 decisions captured in `phase1-foundation.md`. Summary of choices:

- Stack: React + TypeScript (Vite), Python 3.11 on Lambda (container), Hugging Face Transformers, GitHub Actions CI/CD
- Sentiment model: `cardiffnlp/twitter-roberta-base-sentiment-latest`
- Emotion model: `j-hartmann/emotion-english-distilroberta-base`
- Keyword extraction: YAKE
- Deployment path: Lambda container image to ECR
- API protocol: Lambda Function URL (no API Gateway)
- Frontend hosting: GitHub Pages
- AWS region: `us-east-1`

Reasoning: see Decision Record section of `phase1-foundation.md`.

---

## 2026-05-04 — Phase 1 foundation document, v2 revision

Revised the foundation document to fix inconsistencies caught during review. No technical direction changed; only clarifications and corrections.

**Changes:**

1. **Repo naming clarified.** Repository slug is `sentiment-analyzer` (lowercase, hyphenated). Human-readable project name is "Sentiment Analyzer Dashboard". Both are now explicit in the Decision Record.

2. **Default branch confirmed as `main`.** Added an explicit step in Section B for renaming `master` to `main` if the repository was initialized with the older default.

3. **Test corpus revised to English-only.** Removed non-English test inputs. The chosen models are English-only, and out-of-distribution inputs cannot be evaluated without language expertise. Replaced with two new English-language categories that test real model weaknesses: negation (e.g., "not bad at all") and internet shorthand (e.g., "lmao this is fire ngl"). Total test cases: 24.

4. **API contract camelCase made consistent.** Renamed `input` to `inputText` and `timestamp` to `analyzedAt` so multi-word keys follow the stated camelCase convention. Single-word keys (`sentiment`, `emotions`, etc.) unchanged. Sample timestamp updated to a real ISO 8601 string.

5. **README template circularity removed.** Section C now instructs writing the README from scratch with a placeholder structure, rather than referencing a non-existent template file.

6. **IAM policy decision documented.** Phase 1 development user uses AWS managed policies (`AWSLambda_FullAccess`, `AmazonEC2ContainerRegistryFullAccess`, `CloudWatchLogsFullAccess`, `IAMReadOnlyAccess`) for fast iteration. Custom least-privilege policies are deferred to the CI/CD role in Phase 5, where IAM expertise is more naturally demonstrated.

7. **`docs/model-evaluation.md` added to repo structure.** Was referenced in Section F but not listed in the structure tree. Now explicitly listed under `docs/`.

**Why these were caught:** Manual review of the v1 document surfaced inconsistencies between sections. Catching contract mismatches before code is written is significantly cheaper than fixing them after frontend and backend disagree at runtime.

---

## 2026-05-04 — Phase 1 foundation document, v3 revision (tech version refresh)

Updated runtime versions to current as of May 2026. The previous versions were technically still functional but not the right choice for a project starting now. `project-plan.md` was updated in lockstep to keep the at-a-glance section in sync.

**Changes:**

1. **Python: 3.11 → 3.13.** Lambda now supports up to Python 3.14, but 3.13 is the right balance for ML work — well-supported by PyTorch and Transformers, while being meaningfully newer than 3.11. Lambda base image reference in Section G updated to `public.ecr.aws/lambda/python:3.13`. A red-flag note added: if PyTorch installation fails on 3.13, fall back to 3.12 and update the doc.

2. **React: 18 → 19.** React 19 has been stable since December 2024 (currently 19.2.x). Starting a new project on React 18 in 2026 sends the wrong signal. Adopting React 19 also opens up Actions, the React Compiler, and improved form handling as deliberate technical talking points for interviews.

3. **Node.js: 20 LTS → 22 LTS.** Node.js 20 reached end-of-life on April 30, 2026 — four days before this revision. Node.js 22 LTS is supported through April 2027 and has the deepest current ecosystem maturity. Node.js 24 LTS exists and is fine, but 22 was chosen over 24 for stability (it has been LTS for a year vs. weeks). Section A checklist updated to `nvm install 22`.

**Alternatives considered:**
- Python 3.14 (newest): rejected because ML library support on the latest Python release tends to lag by 3–6 months; portfolio projects shouldn't fight that.
- Node.js 24 LTS: valid choice but newer; 22 chosen for ecosystem maturity.
- Staying on Python 3.11 / React 18 / Node 20: rejected as outdated for a project starting in May 2026.

**Why this was caught:** The user explicitly asked whether the previous version was using the latest tech. It was not — the original draft used versions current to my training data, which had drifted out of date. Verified current versions via web search before producing v3.

**Documents updated in this revision:**
- `phase1-foundation.md` → v3
- `project-plan.md` → v2 (Tech stack at a glance section)

Earlier versions remain in Git history.

---

## 2026-05-04 — Phase 1 build: local environment drift recorded

Captured the environment used to build out Phase 1, since it diverges from the v3 spec on several points. None of these are deliberate re-decisions; they reflect the local machine state at the time of the build. Phase 2 should reconcile.

**Local versions used:**
- Python: **3.14.1** (spec says 3.13). The system has only 3.14 installed via the python.org Framework build; pyenv is not installed. The user opted to attempt installation in a 3.14 venv rather than block on installing pyenv + 3.13.
- Node.js: **v25.9.0** (spec says 22 LTS). Not yet exercised — frontend scaffolding lands in Phase 3.
- Docker: 29.4.0 (Desktop). Daemon was off at the start; started during Section G.
- AWS CLI: not installed. Section D ([YOU] items) is unstarted.

**Library outcomes on Python 3.14:**
- `torch==2.11.0` → installed cleanly (cp314 wheels published for arm64 macOS).
- `transformers==5.7.0` → installed cleanly. Version is a major bump from the v3 spec's `>=4.44`; pipeline API still works for our two models, but Phase 2 should re-pin the version after a closer compatibility check.
- `yake==0.7.3` → installed but **fails at import time**. Its transitive dep `networkx==3.6` (latest) is incompatible with Python 3.14: it triggers `AttributeError: 'wrapper_descriptor' object has no attribute '__annotate__'` from CPython 3.14's `dataclasses._add_slots`. This is the exact failure mode the v3 red-flag note warned about. No newer networkx exists yet.

**Net effect on Phase 1:**
- Sections E and F were completed for the two transformer models. The corpus evaluation in `docs/model-evaluation.md` covers sentiment + emotion only; the keyword column reads "(yake unavailable)".
- Sentiment accuracy on the 23 scored cases: **16/23 = 70%**, with all sarcastic and mixed cases failing (per spec expectation), and clear positive/negative/neutral/negation/internet-shorthand all at 100%.
- Mean inference time post-warmup: 230 ms per input on the local laptop — well inside the 5-second red-flag threshold.

**Decision deferred to Phase 2:**
Pick one of the following before model loading lands in the Lambda image:
1. Pin Lambda to Python 3.13 (matches `public.ecr.aws/lambda/python:3.13` already chosen in Section G) and run keyword extraction there. Local dev catches up by installing 3.13 separately. Does **not** require changing the v3 spec.
2. Replace YAKE with a different keyword extractor that does not depend on networkx (candidates: `RAKE`, `KeyBERT` with a small embedding, plain TF-IDF).
3. Drop keyword extraction entirely and remove the word-cloud feature from the dashboard.

Option 1 is the default unless the dev-loop friction proves too high.

**Why this was logged:** The v3 doc explicitly anticipates ML-stack lag. Recording which library actually broke (and how) preserves the reasoning for whichever Phase 2 path is chosen.

---

## 2026-05-04 — Local dev pinned to Python 3.13 (option 1 taken)

Took option 1 from the previous entry. Installed Python 3.13.3 via Homebrew (`brew install python@3.13`) and rebuilt `backend/.venv` against `/opt/homebrew/bin/python3.13`. Reinstalled `transformers`, `torch`, `yake`. Re-ran `backend/explore/evaluate_corpus.py`.

**Outcomes:**
- `yake==0.7.3` (with `networkx==3.6.1`) imports cleanly on Python 3.13.
- Keyword column in `docs/model-evaluation.md` is now populated.
- Sentiment accuracy unchanged at 16/23 = 70 % (deterministic models, same inputs).
- Mean per-input inference dropped from 230 ms to 82 ms post-warmup. The 3.14 number was likely inflated by JIT/cache warm-up; unrelated to the version switch.

**Local environment now:**
- Python: 3.13.3 (matches v3 spec)
- The 3.14 system Python remains installed but unused by this project.
- `pyenv` was not used; Homebrew's `python@3.13` formula is sufficient and was already on the machine.

**Note for Section A of the v3 checklist:**
The doc says "Install pyenv … pyenv install 3.13". This project doesn't use pyenv; it uses Homebrew's `python@3.13` directly. If you ever need parallel 3.12/3.13/3.14 installs, install pyenv then. For one project pinned to 3.13, the simpler path was taken.

**Open items not addressed by this switch:**
- Node.js is still v25.9.0 (spec says 22 LTS). Will be reconciled when Phase 3 starts.
- AWS CLI is still not installed.
- No GitHub remote exists yet; `main` is a local-only branch.

---

## 2026-05-05 — Phase 1 foundation document, v4 (status pass)

Bumped `phase1-foundation.md` from v3 to v4. No technical direction changed; v4 records the actual state of Phase 1 progress and incorporates clarifications surfaced in the prior two entries.

**Changes:**

1. **Setup checklist ticked.** Boxes are now checked for items the build has actually completed.
   - Section A: Python 3.13, Docker, Git (≥ 2.30), Git identity, editor — done. Node 22 LTS, AWS CLI v2 — still outstanding.
   - Section B: GitHub account confirmed, public repo created (registered as `Sentiment-Analyzer` — minor case drift from the lowercase spec slug; can be renamed via GitHub Settings if strict). 2FA, GitHub-side initialization, master→main rename, fresh clone — not applicable or still outstanding because the repo was scaffolded locally first and `origin` was added later.
   - Section C: all done; commit at `00fd4c0`. Push to `origin` still pending — local `main` is one commit ahead of `origin/main`.
   - Section D (AWS): entirely outstanding.
   - Section E: all done. `backend/explore/evaluate_corpus.py` is the model exploration script.
   - Section F: all done. Surprising failures recorded in `docs/model-evaluation.md`.
   - Section G: stub Dockerfile and handler exist; the build/run/teardown smoke-test items are unchecked pending verification.
   - Section H: not checked — Phase 1 closeout requires Section D and the Section G smoke test.

2. **Section A pyenv softened.** The pyenv install step is now marked optional. The Python 3.13 step accepts either pyenv or Homebrew. This codifies the option-1 decision from the previous entry.

3. **Section G preamble note added.** The Phase 1 stub Dockerfile is multi-arch by default; explicit `--platform=linux/arm64` pinning is deferred to Phase 2 production builds. Also noted that the Python 3.13 Lambda base image is on Amazon Linux 2023 (use `dnf` not `yum` if OS packages are added later).

4. **Latest tech versions re-verified on 2026-05-05.** Web search confirmed:
   - **React 19.2.5** is current (April 2026). Spec value "React 19" still right.
   - **Node.js 22 LTS** supported through April 30, 2027. **Node.js 24 LTS** released April 2026 but only one month into LTS — v3 reasoning to prefer 22 for ecosystem maturity still holds.
   - **Python 3.13** still supported on AWS Lambda as both managed runtime and container base image (on Amazon Linux 2023). Lambda also supports Python 3.14, but the v3 rejection of 3.14 (ML library lag — confirmed empirically by the YAKE/networkx failure on 3.14) still applies.
   - **Vite "latest"** today resolves to **Vite 8** (released March 2026). Requires Node 20.19+ / 22.12+, compatible with the chosen Node 22 LTS. `@vitejs/plugin-react` v6 ships alongside it (Oxc-based, no Babel dep). Spec wording stays as "Vite (latest)".

**Phase 1 status as of v4:**
- Sentiment + emotion + keyword evaluation complete; 16/23 sentiment accuracy, 82 ms post-warmup inference (see `docs/model-evaluation.md`).
- Local Python 3.13.3 environment working with `transformers`, `torch`, `yake`.
- Local Node still on v25.9.0; will be reconciled when Phase 3 begins.
- AWS account preparation (Section D) entirely outstanding.
- GitHub remote registered at `origin`; `main` is one commit ahead and unpushed.
- No `phase-1-complete` tag yet.

**Documents updated in this revision:**
- `phase1-foundation.md` → v4

Earlier versions remain in Git history.

---

## 2026-05-05 — Phase 1 progress: GitHub setup completed, AWS Section D landed

Status update following the v4 bump entry above. Both open infrastructure tracks (GitHub Section B, AWS Section D) advanced on the same day. Recording the new state so the v4 entry's "outstanding" claims are not misread as still-current.

**GitHub (Section B) — complete:**
- 2FA enabled on the GitHub account.
- Initial scaffolding pushed at `00fd4c0`. The follow-up commit `1edb65e` (Python 3.13 pin doc updates) was unpushed at v4 bump time and has now also been pushed; remote tip is `6122a7f`.
- GitHub-side init / `master`→`main` rename / fresh clone remain N/A — the repo was scaffolded locally first and `origin` was added afterward.
- Minor: the remote slug is `Sentiment-Analyzer` (capital S) rather than the spec's lowercase `sentiment-analyzer`. Not blocking; can be renamed via GitHub Settings if strict slug consistency is wanted.

**AWS (Section D) — mostly complete:**
- AWS account `323336951250`. Root MFA enabled. No root access keys (`AccountAccessKeysPresent = 0` via `iam get-account-summary`).
- IAM user `sentiment-dev` created. Virtual MFA registered 2026-05-06 UTC (late evening 2026-05-05 in US time zones).
- Local AWS CLI v2 (`aws-cli/2.27.20`) installed via Homebrew; `aws configure` set to `us-east-1`; `aws sts get-caller-identity` returns `arn:aws:iam::323336951250:user/sentiment-dev`.

**Deviation worth recording — group-based policy attachment:**

The four required AWS managed policies (`AWSLambda_FullAccess`, `AmazonEC2ContainerRegistryFullAccess`, `CloudWatchLogsFullAccess`, `IAMReadOnlyAccess`) are attached via group `sentiment-dev-group`, not directly to the user as Section D's literal wording suggested. This is functionally equivalent for the dev user but operationally cleaner: if more IAM users are ever added (collaborator, second machine, etc.), they can be added to the group rather than re-attaching policies one by one, and the policy set can be updated in one place. No security or capability difference for Phase 1. Future Section D wording should accept either direct or group-based attachment.

**Still outstanding for Phase 1:**
- AWS billing alert at $5/month threshold + SNS subscription email confirmation (Section D last two items).
- Node 22 LTS install via nvm (Section A — local still on Node 25.9.0).
- Section G Docker smoke test: build, run, verify handler response, tear down stub image.
- `phase-1-complete` tag (Section H).

No technical decisions changed in this update.

**Documents updated in this revision:**
- None. This is a status entry, not a doc revision.

---

## 2026-05-06 — Phase 1 doc corrections: Node status superseded, API contract tightened

The 2026-05-05 status entry above said Node 22 LTS was still outstanding. That status was superseded later the same day by commit `0a9c648` (`Phase 1: install Node 22 LTS, complete Section A`). Node v22.22.2 is installed via nvm, `default` points at `22`, and the Section A Node item plus the local-environment success criterion should remain checked in `phase1-foundation.md`.

Also tightened the Phase 1 API contract before Phase 2 implementation:

- Renamed `keywords[].weight` to `keywords[].score` to match YAKE's raw score semantics.
- Documented that lower YAKE scores are more relevant, so the frontend word cloud must invert or normalize scores before using them for visual size.
- Added a baseline `4xx` error response shape for `EMPTY_INPUT`, `INPUT_TOO_LONG`, and `INVALID_JSON`.
- Left language rejection out of the committed error codes for now; the product is English-only, but Phase 2 has not yet chosen a language-detection mechanism.
- Added a Lambda memory sizing note: 2048 MB remains the baseline, with 3072 MB as the first tuning target if combined model loading or cold starts need more headroom.
- Updated the red-flag note to reflect the actual Phase 1 dependency issue: YAKE/networkx failed on Python 3.14.1; the stack works on the current Python 3.13.3 pin.

No version bump to `phase1-foundation.md`; these are contract/status clarifications within the v4 status pass.

---

## 2026-05-05 errata — Node LTS wording and release-cycle context

This corrects the Node wording in the 2026-05-05 v4 status entry without changing the project runtime choice. Node 24 LTS was not newly released in April 2026, and it does not have a shorter LTS window: Node 24 (Krypton) was initially released on 2025-05-06, entered Active LTS on 2025-10-28, is scheduled to enter Maintenance LTS on 2026-10-20, and reaches EOL on 2028-04-30.

The sharper interview narrative is: Node 22 (Jod) is Maintenance LTS as of this status pass, supported through 2027-04-30; Node 24 (Krypton) is Active LTS, supported through 2028-04-30. Choosing Node 22 remains a conservative ecosystem-maturity call, not a claim that Node 22 is the more active or longer-supported LTS line.

Context: Node has announced a release-schedule change starting with 27.x. The odd/even split is going away, every release will become LTS, and the project is moving from two major releases per year to one major release per year. That future change does not affect this project's Node 22 pin; it only changes how to explain Node's release model going forward.

---

## 2026-05-06 — Phase 2 planning review, v3

Applied the external review comments that materially improve the project plan and Phase 2 backend spec.

**Changes accepted:**

1. Removed `local_dir_use_symlinks=False` from the `snapshot_download(...)` example. Hugging Face Hub v1.x removed that parameter; `local_dir` is enough for the Docker build snapshot layout.

2. Tightened the Transformers pinning plan. Phase 2 now treats Transformers v5 as a major compatibility decision, uses `transformers==5.8.0` as the current candidate, keeps `5.7.0` as the Phase 1-verified fallback, and requires real model-load smoke tests before committing the pin. Any fallback to 4.x must include a current security-advisory check and a logged reason v5 was rejected.

3. Clarified Node.js lifecycle wording in `docs/project-plan.md`. The runtime remains Node 22 LTS by choice, but the plan now says it is Maintenance LTS and that Node 24 is the Active LTS alternative.

4. Changed Phase 2 `INPUT_TOO_LONG` from `413` to `422`. The 5000-character limit is validation on a parsed JSON field, not a physical request-body limit. Platform-level body-size failures remain outside the handler-owned error envelope.

5. Documented Lambda Function URL throttling. Reserved concurrency can produce service-generated `429 Too Many Requests`; clients should map that to a throttled state, but tests should not expect the handler's JSON error envelope.

6. Made validation precedence contractual: method check, optional base64 decode, JSON parse/object check, then `text` schema/business validation.

7. Replaced reusable Phase 2 command examples with `<account-id>` placeholders. The real AWS account ID remains recorded in earlier private/status context, but the phase spec no longer repeats it in copy-pasteable commands.

8. Added a CloudWatch Logs retention step using 14 days, so logs do not default to indefinite retention.

9. Added Phase 3 frontend testing and accessibility scope to the project plan: Vitest, React Testing Library, Playwright smoke tests, axe checks, semantic HTML, and keyboard navigation.

**Changes not accepted as written:**

- Did not automatically switch the project from Node 22 to Node 24. Node 24 is the more current Active LTS line, but Node 22 remains supported through 2027-04-30 and was already installed locally. The plan now states the tradeoff instead of implying Node 22 is the most current LTS line.

---

## 2026-05-06 — Phase 2 dependency pins committed

`backend/requirements.in` and the `pip-compile`-generated `backend/requirements.txt` now reflect the Phase 2 candidate pins. All four direct pins resolve clean on Python 3.13 / Linux ARM64 with no broken transitives (`pip check` clean inside the deps-only image). The Phase 2 spec's auto-fallback to `transformers==5.7.0` was not triggered.

| Direct pin | Version | Source |
|---|---|---|
| `transformers` | `5.8.0` | Latest stable per PyPI on 2026-05-06; spec candidate (line 52 of `phase2-backend.md`) |
| `torch` | `2.11.0` | Spec value; resolved as `2.11.0+cpu` via PyTorch CPU index (see next entry) |
| `huggingface_hub` | `1.13.0` | Latest 1.x per PyPI on 2026-05-06; pinned directly because Hub 1.x changed `snapshot_download` parameters |
| `yake` | `0.7.3` | Phase 1 verified; same as Phase 1 explore env |

Transitive `networkx==3.6.1` is left to `pip-compile` (resolved via both yake and torch). The spec only required a direct pin for `huggingface_hub`. `pytest==9.0.3` and `pip-tools==7.5.3` live in `requirements-dev.txt` and never enter the image.

---

## 2026-05-06 — Phase 2 image-size fix: PyTorch CPU index

The first deps-only image build at `transformers==5.8.0` / `torch==2.11.0` weighed **3.13 GB**, of which **2.8 GB was unused NVIDIA CUDA libraries** (`nvidia-cublas`, `nvidia-cudnn-cu13`, `nvidia-cufft`, `nvidia-cusparse`, `nvidia-cusolver`, etc.) plus **600 MB of Triton** (a GPU-targeting compiler). AWS Lambda has no GPU; this is dead weight.

Phase 1 never noticed this because the local explore venv runs on macOS arm64, where the regular PyPI `torch==2.11.0` wheel is already CPU-only. The CUDA payload only ships in the `manylinux_2_28_aarch64` (and x86) wheels on PyPI.

**Fix:** added `--extra-index-url https://download.pytorch.org/whl/cpu` to `requirements.in`. PEP 440 makes `2.11.0+cpu` (from the CPU index) sort above `2.11.0` (from PyPI) for the same constraint string, so `pip` selects the CPU-only wheel automatically. macOS dev environments still get their normal torch wheel because the CPU index doesn't ship macOS wheels under the same name pattern.

Outcome:
- Deps-only image: **3.13 GB → 452 MB** (2.7 GB saved)
- Full image (deps + 1.5 GB of model snapshots + app code): **1.85 GB total** (well under Lambda's 10 GB uncompressed limit)
- Cold pull and Lambda image cache populated faster on first deploy

This deviates from a literal reading of the Phase 2 spec (which only mentions PyPI), but stays within its intent (small, fast, ARM64 image that boots quickly). Recorded as a deliberate Phase 2 decision.

---

## 2026-05-06 — Phase 2 model revision SHAs

Pinned via Dockerfile `ENV` declarations (single source of truth for build, runtime logging, and slow tests). Fetched from `https://huggingface.co/api/models/{repo}` on 2026-05-06.

| Model | Repo | Revision SHA | Latest commit date |
|---|---|---|---|
| Sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` | `3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7` | 2025-08-04 (README update) |
| Emotion | `j-hartmann/emotion-english-distilroberta-base` | `0e1cd914e3d46199ed785853e12b57304e04178b` | 2023-01-02 (README update) |

Both SHAs are emitted in the cold-start `INFO` log line at module init, captured by both fast-tier (`test_cold_start_log_contains_both_revision_shas`) and slow-tier (`test_cold_start_log_with_real_models`) pytest checks.

---

## 2026-05-06 — Phase 2 contract revision committed in code

The Phase 2 backend now implements the contract revisions that `phase2-backend.md` v4 specified:

- `METHOD_NOT_ALLOWED` (`405`) for non-`POST` methods, with `Allow: POST` response header. `OPTIONS` requests reaching the handler in tests follow the same rule; in production CORS preflight is answered by the Function URL configuration before the handler runs.
- `INPUT_TOO_LONG` returns `422` (not `413`). The 5000-character limit is a parsed-field business rule, not a transport-layer body-size violation, so `422` is the correct semantic. Phase 1's earlier doc still mentions `413` for the same condition; the Phase 2 implementation is the source of truth.
- `INVALID_JSON` (`400`) covers missing body, malformed JSON, base64 decode failures, and parsed non-object values (arrays, scalars).
- `EMPTY_INPUT` (`400`) covers missing/empty/whitespace-only `text` plus wrong-type `text` (numbers, lists, booleans). Spec language `text missing` is interpreted broadly to include "not a usable string".
- Validation precedence is contractual and enforced in code: method → optional base64 decode → JSON parse + object check → schema/business validation. Each precedence boundary is covered by a dedicated test in `tests/test_validation.py`.
- Reserved-concurrency `429 Too Many Requests` is a service-generated response from Lambda Function URL when reserved concurrency is exhausted. Body and headers are AWS-owned; tests assert status code only, never the JSON envelope shape. Frontend should map `429` to a `THROTTLED` user state without parsing as the handler error envelope.

47 pytest cases cover the contract (39 fast + 8 slow); all 4 RIE smoke cases against the built container produce the expected status codes and bodies.

---

## 2026-05-06 — Phase 2 start with billing alert deferred (deviation)

`phase2-backend.md` "Pre-flight (Phase 1 closeout)" required an AWS billing alert at $5/month plus an SNS subscription email confirmation before Phase 2 begins. The Phase 1 IAM user `sentiment-dev` lacks `budgets:ViewBudget`, `cloudwatch:DescribeAlarms`, and `SNS:*` (verified — all three return AccessDenied), so the budget would need to be created via the AWS console as the root user. Rather than block Phase 2, the user opted to proceed with the build under the existing cost guardrails and address billing alerts later.

**Compensating controls in effect:**
- Reserved concurrency = 10 caps parallel invocations. With 30-second Lambda timeout and ARM64 2048 MB pricing, worst-case sustained spend is bounded to a low single-digit dollar/hour rate even under hostile traffic.
- ECR storage cost is negligible at the ~1.85 GB image size.
- CloudWatch Logs retention is set to 14 days (Phase 2 spec line 425), so log storage doesn't grow unbounded.

**Follow-up:** when the user has root-console time, add the $5/month budget + SNS topic + confirmed email subscription, then update this entry with the date and budget ARN. Until then, Phase 1 Section H is treated as closed-with-deviation for the purpose of the `phase-1-complete` tag (already applied at commit `235cd56`, 2026-05-06).

---

## 2026-05-06 — Phase 2 deploy: account-quota and AWS-API constraints

These deviations from `phase2-backend.md` came up during the AWS deploy. None change the inference behaviour or contract; they're operational adjustments. Full per-deviation reasoning is in `phase2-results.md` § "Deviations from phase2-backend.md".

1. **IAM role created via root console.** `sentiment-dev` has `IAMReadOnlyAccess` (Phase 1 v2 decision). The `sentiment-analyzer-lambda-role` was therefore created in the root account session: trust policy for `lambda.amazonaws.com`, `AWSLambdaBasicExecutionRole` attached. ARN: `arn:aws:iam::323336951250:role/sentiment-analyzer-lambda-role`.

2. **Reserved concurrency not applied.** Account-wide concurrent-execution quota is **10**, with an `UnreservedConcurrentExecutions` floor of 10. Setting reserved=10 would leave 0 unreserved, which AWS rejects (`InvalidParameterValueException: ... decreases account's UnreservedConcurrentExecution below its minimum value of [10]`). The account-wide cap already enforces parallel-invocation limits equivalent to the spec's intent. To apply spec strictly, request a quota increase to ≥ 20.

3. **Memory matrix incomplete.** Spec mandates 2048 / 3072 / 4096 measurements. Account ceiling for per-function memory is **3008 MB** (`MemorySize value failed to satisfy constraint: Member must have value less than or equal to 3008`). Matrix reported at 2048 + 3008; 4096 row marked unmeasurable. Production memory size: 3008 MB (closest available to the spec's 3072).

4. **CORS `AllowMethods=["POST"]`, no `OPTIONS`.** Spec wording suggests `["POST", "OPTIONS"]` but AWS Function URL CORS API enforces a 6-character maximum length per method element; `"OPTIONS"` (7 chars) fails validation. The Function URL implicitly handles CORS preflight when CORS is configured, so explicit `OPTIONS` listing is unnecessary. The browser-facing behavior is unchanged.

5. **Two resource-policy statements required for public Function URL access.** AWS changed the Function URL access model in October 2025 (verified in current AWS docs): `auth-type=NONE` invocations now require both `lambda:InvokeFunctionUrl` *and* `lambda:InvokeFunction` permissions in the resource policy. Without both, the URL returns `403 Forbidden` even with the spec's listed policy. The current policy adds both statements; the second one omits the recommended `lambda:InvokedViaFunctionUrl` condition because the local AWS CLI (2.27.20) does not yet support the `--invoked-via-function-url` flag. This is functionally permissive (anyone with the function ARN can call `Invoke` directly) but not exploitable from the public internet without the URL ARN. Tightening is a Phase 5 / CI-hardening item.

6. **Docker buildkit OCI manifests rejected by Lambda.** First image push used the buildkit default attestation manifest list, which `aws lambda create-function --code ImageUri=...` rejected with `The image manifest, config or layer media type for the source image ... is not supported`. Fix: rebuild with `--provenance=false --sbom=false` (forces Docker v2 schema 2). The Dockerfile and image content are unchanged. Phase 5 CI must include the same flags.

7. **First-ever cold start = ~85 s.** A fresh Lambda function pulling its 1.85 GB image from ECR onto a new instance pool exceeds the spec's <15 s cold-start budget. Steady-state cold starts on a warmed instance pool measure ~5–10 s, within budget. The spec's 30 s function timeout will occasionally cause a 502 if Lambda re-provisions onto a fresh host; this is acceptable for Phase 2 portfolio scope (re-evaluate in Phase 6 if real users hit it).

These deviations are recorded once in this single entry, with full per-deviation context in `phase2-results.md`. Function deployed and live: `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/`.

---

## 2026-05-07 — Phase 2 closeout: billing alert in place + CORS preflight verified

Two of the three Phase 2 follow-ups noted at `phase-2-complete` time are now closed.

**Billing alert + SNS subscription — done.** The 2026-05-06 "Phase 2 start with billing alert deferred (deviation)" entry above is superseded. The user configured the $5/month AWS budget and confirmed the SNS subscription email via the root console. The Phase 1 Section H success criterion is now strictly met, not closed-with-deviation. No corresponding code or infrastructure change was needed — purely a console action.

**CORS preflight (OPTIONS) verified against the live Function URL — done.** `phase2-backend.md` line 540 ("CORS preflight (OPTIONS) returns expected headers") was the last unverified deploy-checklist item. Run on 2026-05-07:

```
curl -i -X OPTIONS https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/ \
  -H 'Origin: https://asdfghjklzxc123.github.io' \
  -H 'Access-Control-Request-Method: POST' \
  -H 'Access-Control-Request-Headers: content-type'
```

Response: `200 OK` with `Access-Control-Allow-Origin: https://asdfghjklzxc123.github.io`, `Access-Control-Allow-Methods: POST`, `Access-Control-Allow-Headers: content-type`, `Access-Control-Max-Age: 300`, and `Vary: Origin`. The Function URL handled preflight without invoking the handler — confirms the 2026-05-06 deviation entry item 4 (CORS `AllowMethods` without `OPTIONS`) is functionally equivalent to the spec's intent. Recorded in `phase2-results.md` as the fifth row of the deployed-URL smoke tests table.

**Still open from `phase-2-complete`:** only the optional `lambda:InvokedViaFunctionUrl` condition tightening (CLI 2.27.20 doesn't support the flag; manual `lambda put-policy` JSON edit required). Not in `phase2-backend.md`; pulled from current AWS docs. Defer to Phase 5 (CI hardening) per the existing deviation entry.

**Quota-bound items remain accepted limitations:** 4096 MB memory matrix row and reserved concurrency = 10 require AWS Service Quotas requests the user has chosen not to file.

---

## 2026-05-08 — Phase 3 deviations from `phase3-frontend.md` / `phase3-ui-ux.md`

Phase 3 (frontend stabilization, audit at `docs/phase3-audit.md`) is functionally complete: 113 automated tests passing (108 vitest + 5 Playwright), `tsc --noEmit` and `eslint .` clean, axe scans clean across idle/loading/success/error, live Lambda contract sanity-checked against `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/`. Bundle gzipped initial chunk = ~72 KB (well under the 250 KB target). Full results in `docs/phase3-results.md`; what follows is the catalog of deviations from the spec and audit, with the rationale for each. Manual keyboard pass and screen-reader pass (procedures in `phase3-results.md`) are still pending — they require human eyes — and the `phase-3-complete` tag is held until they're done.

### Color & accessibility

1. **Sentiment color tokens darkened.** Spec §5.1 starting hex values (`--color-positive: #2e7d32`, `--color-negative: #c62828`, `--color-neutral: #546e7a`) were "tuned for WCAG AA contrast on white bg" but axe found a real violation: 4.35:1 against the badge's own 12%-tint background, just below the 4.5:1 AA threshold. Plus `.sb-pct` had `opacity: 0.85` which dropped the percentage to 3.38:1. Two fixes: darken to `#1b5e20` / `#b71c1c` / `#37474f` (same hue family, deeper shade — passes 4.5:1 on the tinted bg), and drop the `.sb-pct` opacity (visual deemphasis now comes from font-weight only). Spec §11.4 mandates AA, which beats spec §5.1's specific hex values.

2. **`--color-emotion-surprise` swapped from #00838f (teal) to #d81b60 (pink).** Brettel-Vienot-Mollon color-blind simulation found `sadness ↔ surprise` collisions in **all three** vision types (protan/deutan/tritan) — both are blue-family colors and collapse together for any blue-axis impairment. Audit/spec rule was clear: "If any two collapse, swap one and document." Surprise to Material pink-A700 sits in a distinct hue family. Confirmed by re-running the simulator: clean across protan and deutan, residual `disgust ↔ fear` only under tritanopia.

3. **Tritanopia `disgust ↔ fear` residual collision accepted.** Green (`#558b2f`) and purple (`#6a1b9a`) both project to muddy grey under blue-yellow blindness; no two-color swap fixes both simultaneously without breaking other pairs. Tritanopia incidence is ~0.001%; emotion bars carry text labels and percentage values alongside the bar fill (spec §11.4: "color is never the only signal") so the collision is reinforcing, not load-bearing. A more thorough palette redesign is a Phase 6 item if it ever blocks a recruiter walkthrough.

4. **Backend returns 7 emotions including `neutral`; spec §5.1 listed 6 emotion-color tokens.** The Phase 1 / Phase 2 contract returns `{anger, disgust, fear, joy, neutral, sadness, surprise}` because `j-hartmann/emotion-english-distilroberta-base` outputs all 7. Frontend renders all 7. Rather than adding a `--color-emotion-neutral` token, the 7th color reuses the existing sentiment `--color-neutral` (#37474f). Sentiment-neutral and emotion-neutral therefore share a hue, which is fine because they appear in different visual contexts (badge vs bar).

### API client / state shape

5. **`ApiError` includes `kind: 'server'` and `kind: 'parse'`.** The audit listed `{network, timeout, parse, http, throttled}` for the union. Added `server` (5xx) because spec §6 has a 5xx banner class distinct from the handler-envelope 4xx, and AWS-generated 502/504 don't follow the documented `{error: {...}}` shape. `parse` was already in the audit's list; explicit here for completeness.

6. **`AnalysisState.savedAt: number | undefined` on the success branch.** The audit's discriminated union didn't include this. Added so the UI can render "Showing saved result from N min ago" when re-rendering a history entry, distinct from a fresh API result. Typed as `number | undefined` (not `?: number`) so callers under `exactOptionalPropertyTypes` can pass through without runtime branching.

7. **`useAnalysis.showSaved(view, savedAt)`.** Not in the spec's `{state, run, reset}` API. Added so `App` can route a history click into the same state machine without bypassing it. Without `showSaved`, App would have to track a parallel `displayedView` and ResultsPanel would consume two different sources of result data.

### History persistence

8. **Storage key renamed `sa.history.v1` → `sad:history:v1`.** Spec §7 names the new key. `useHistory.loadOrMigrate()` reads the legacy key once on first load, attempts a best-effort conversion (Title-Case emotion labels → lowercase `EmotionKey`s, legacy higher-better keyword score → `weight`), writes the result under the new key, and leaves the legacy key in place per spec §7 ("avoids destructive errors").

9. **History persists view-model, not raw `AnalysisResponse`.** Spec §7 didn't pick one. Persisting the view-model means `HistoryList` doesn't have to re-run `toView()` (including the YAKE inversion + emotion sort) on every render. Cost: schema must increment to `:v2` if the view-model shape ever changes. Worth it for the per-render savings and the clean separation between API contract types and persisted state.

### Build & visual

10. **Recharts not used.** Spec §8 picks Recharts for the emotion chart. The hand-rolled CSS bar implementation in `EmotionChart.tsx` is faithful to the spec's visual layout (bars sorted desc, accessible table fallback under `<details>` that auto-opens at narrow widths per §6.3) and adds zero bundle weight. The 250 KB target is comfortably met (68 KB gzipped JS) so Recharts could be added later if/when more chart types are needed; for now the hand-rolled bars are simpler and tested.

11. **Tweaks panel removed from production.** Legacy `App.jsx` shipped a debug latency/error injection panel that opened via a `__activate_edit_mode` postMessage from a parent frame. Not in the spec; not appropriate for the production bundle. The new `App.tsx` has no postMessage hooks. Equivalent functionality during development is provided by MSW handler factories (`src/test/handlers.ts` exports `serverErrorHandler(503)` etc.) that tests use instead.

12. **Legacy `.jsx` files retained alongside the `.tsx` port.** Per the audit's instruction "keep the old HTML+Babel entry working until ports complete." `frontend/Sentiment Analyzer.html` continues to load `src/{App,hooks/useAnalysis,components/*}.jsx` via Babel-Standalone. The new entry is `frontend/index.html` → `src/main.tsx` → `App.tsx`. Vite's `resolve.extensions` is explicitly reordered to `[".mjs", ".mts", ".ts", ".tsx", ".js", ".jsx", ".json"]` so `@/App` resolves to the `.tsx` port (default order would pick `.jsx` first). After tagging, the `.jsx` files can be deleted in a cleanup commit.

13. **Dev-server port pinned to 5179 for e2e (not the Vite default 5173).** Another local Vite instance ("Notes" project) holds 5173 on this machine. Playwright's `webServer` block runs `npm run dev -- --port 5179 --strictPort` so the e2e suite is reproducible regardless of what else is running. Interactive `npm run dev` still uses 5173 by default with Vite's automatic port-bumping.

### Process

14. **Codex (`gpt-5.5`) used as a critical-review pass between major steps.** External LLM read the audit doc, then each step's diff, with explicit instructions to check the actual code rather than trust prior summaries. Caught: a duplicate-add `useEffect` regression in `App.tsx` (history dep was the whole `useHistory` return object instead of the stable `addHistory` callback), a timestamp-collision concern in `selectedId`, three missing tap-target spec compliance issues (44 × 44 minimum — fixed in CSS), and the missing-from-deviations 7th-emotion call-out. Each finding was triaged before moving on. Worth keeping the codex pass for Phase 4+.

These deviations are recorded once in this entry, with full per-deviation context in `docs/phase3-results.md`. The combined acceptance checklist (`docs/phase3-frontend.md` §13 + `docs/phase3-ui-ux.md` §13) has four pending human checks before `phase-3-complete` can be tagged: (1) end-to-end keyboard pass, (2) screen reader pass with VoiceOver or NVDA on success/error states, (3) visual-state confirmation that the five states (empty, loading-tier-1, loading-tier-3, success, error) match the spec, (4) reduced-motion DevTools verification (CSS already gates animations on `prefers-reduced-motion`, but the spec wants the toggle exercised in DevTools to confirm). All four are documented procedures in `docs/phase3-results.md` §"Accessibility".

---

## 2026-05-08 — Phase 3 §12 open questions resolved

`docs/phase3-ui-ux.md` §12 listed four open questions to resolve during the build. Each was supposed to get a decision-log entry once answered. Logged here as the closeout for that section.

1. **History selection — re-run analysis on the saved input?** **No.** `useAnalysis.showSaved(view, savedAt)` and the click flow in `App.tsx` (`handleSelectHistory`) re-render the stored view-model directly without invoking `analyzeText`. Spec leaning was "default to no" to avoid scope creep; build matches that. Re-running is a Phase 6 polish item if comparing model versions becomes useful later.

2. **Sample input chips — how many and what content?** **Three chips**: "Try a tweet", "Try a review", "Try a product complaint" (`frontend/src/components/TextInput/TextInput.tsx:5-22`). Each is a hand-crafted prompt picked to produce a visibly different sentiment + emotion mix when run through the live model — verified manually against the deployed Lambda during step 8. Spec leaning was three; build matches.

3. **Empty-state illustration vs. icon vs. nothing?** **Icon.** `EmptyState` (in `ResultsPanel.tsx`) renders an inline 64×64 SVG document outline in `--color-text-mute` next to the "Paste some text to get started" heading. The icon is decorative (`aria-hidden="true"`); the heading is the load-bearing announcement for screen readers. Illustration was rejected as adding asset weight without proportionate portfolio value; "nothing" was rejected because the empty card looked broken. Spec leaning was the safe icon default; build matches.

4. **Animation for the emotion chart bars — slide-in or static?** **Static.** Bars render at their final width on mount via inline `style.width`; the only animation in the chart region is the skeleton shimmer during loading, which is gated by `prefers-reduced-motion: reduce` in `tokens.css:139-146`. Spec leaning was "lean static" for simplicity + reduced-motion compatibility; build matches. Slide-in was rejected because spec §9 caps motion at 250 ms and bans looping idle animations, and a 7-bar slide cascade adds visual noise without information gain.

---

## 2026-05-09 — Phase 3 closeout: dev-only Vite proxy for CORS, all human checks confirmed

Two final closeout items captured before the `phase-3-complete` tag.

1. **Vite dev-server proxy at `/api/analyze` → live Lambda Function URL.** The Lambda's `AllowOrigins` (per the deployed CORS config in `phase2-results.md`) is locked to the GitHub Pages domain `https://asdfghjklzxc123.github.io`. A browser POST from `http://localhost:5180` to the Function URL fails preflight with "No 'Access-Control-Allow-Origin' header is present on the requested resource." `phase2-backend.md` lines 322-324 anticipated this exact case and prescribed the proxy fix. `frontend/vite.config.ts` now has a `server.proxy` block forwarding `/api/analyze` server-to-server to the Lambda root with `changeOrigin: true` and a path rewrite. The dev environment sets `VITE_LAMBDA_URL=/api/analyze` (a relative path, browser sees same-origin); production builds set `VITE_LAMBDA_URL` to the deployed Function URL via Phase 5 CI/CD. The proxy is dev-only and has no effect on the production bundle. Alternative considered: temporarily add `http://localhost:5180` to the Lambda's `AllowOrigins` and remove before public demo. Rejected because (a) it modifies live infrastructure for a local-dev workaround, (b) requires manual cleanup before tagging, and (c) `phase2-backend.md` already named the proxy as the preferred path.

2. **All four human acceptance checks completed** (`docs/phase3-frontend.md` §13 + `docs/phase3-ui-ux.md` §13). Recorded in `docs/phase3-results.md` §"Accessibility":
   - **Keyboard pass:** end-to-end Tab order, focus rings, focus moves, ConfirmDialog focus trap all confirmed.
   - **Screen reader pass:** VoiceOver verified header + Analyze region (2026-05-08); error/success live-region announcements verified end-to-end via the cold-start timeout cycle (2026-05-09).
   - **Visual-state confirmation:** empty (screenshot, 2026-05-08); loading-tier-1, loading-tier-3, success, and error all observed 2026-05-09 (the error case was the unintentional but spec-correct timeout banner during a cold start).
   - **Reduced-motion DevTools verification:** with `prefers-reduced-motion: reduce` emulated, the loading skeleton appeared and resolved without sustained shimmer animation.

`phase-3-complete` is ready to tag. Phase 4 (`docs/phase4-integration.md`, to be created) inherits a stabilized frontend with: typed API boundary against the deployed Lambda, full state-machine + history hooks, six visual states tested, axe-clean accessibility, 113 automated tests passing, and dev-only proxy in place. Phase 4 owns the rest of cold-start UX hardening, the actual `AllowOrigins` listing for the deployed dev/preview origin if needed, and end-to-end network-failure validation against the live system.

---

## 2026-05-09 — Phase 4 §3 + §5: Vite base, prod-build env, cold-start copy, loading-tier thresholds

Pre-deploy edits ahead of the §2 step 4 `gh-pages` push. Captured here per `phase4-integration.md` §11 ("decision-log.md updated for any spec deviations or copy/timing edits from §5 / §9").

1. **Vite `base` set to `/Sentiment-Analyzer/`** in `frontend/vite.config.ts`. Case-exact match to the GitHub repo slug from `git remote -v`. Without this the bundle's asset URLs resolve to `/assets/*` and 404 from the Pages origin. Verified locally: `VITE_LAMBDA_URL=https://...lambda-url.../ npm run build` produces `dist/index.html` with `<script src="/Sentiment-Analyzer/assets/index-...js">`, the Lambda hostname is inlined into the JS chunk (one grep hit), and `npm run preview` redirects bare `/` to `/Sentiment-Analyzer/`. Dev proxy at `/api/analyze` is unaffected because it's an absolute proxy key.

2. **`VITE_LAMBDA_URL` documented as a build input** in the root `README.md` Frontend section. No `frontend/README.md` exists; the spec allowed either ("alongside `frontend/README.md` or in a new section there"). The new "Production build" subsection records the absolute Function URL for prod and explains why local `npm run preview` is not a CORS check. CI automation of this flow is Phase 5's scope, not Phase 4's.

3. **`kind: 'server'` banner copy generalized to cold-start-aware wording** (§5 item 1). Old: title "Something went wrong on our end." / body "This is rare — please try again." New: title "The server may still be waking up." / body "Please try again." (`frontend/src/components/ResultsPanel/ResultsPanel.tsx:138-142`). Reasoning: at 3008 MB the most common 5xx in this stack is a re-provisioned cold start (Phase 2 deviation #6), so "rare" misled users. The discriminated union stays at `{network, timeout, parse, http, server, throttled}` — no new `kind: 'cold-start'` was added because (a) it leaks an infra guess into the client contract, and (b) AWS service-generated 502s may arrive without CORS headers and surface as `kind: 'network'` instead, so any kind-specific cold-start handling would already be wrong half the time. Test in `ResultsPanel.test.tsx` updated to assert the new substring.

4. **`kind: 'timeout'` banner copy left as-is** (§5 item 2). "That took longer than expected. The model may be cold — try again." remains the right message for the slow-init mode (`AbortController` 30 s ceiling on a 5–15 s cold init drag).

5. **Loading-tier thresholds left at 1500 / 3000 / 10000 ms** (§5 item 4, option (a) recommended in spec). Phase 2 records warm p95 = 1,568 ms; the slow ~5% of warm requests dip into Tier 2 (silent skeleton) for ~70 ms before the success state replaces it, and never trigger the Tier 3 "Warming up" caption — so the misleading-caption risk the threshold review was guarding against is not present. Moving the spinner-to-skeleton break to 2 s was the alternative; rejected as not strictly necessary and one-more-thing-to-revisit.

Out of scope for this entry (deferred to live verification): browser CORS check from the Pages origin (§4), cold-start retry confirmation in the live env (§5 item 3), and the §6 error-class matrix.

---

## 2026-05-09 — Phase 4 §7 audit + closeout of decision-log #12 (legacy .jsx removed)

§7's "single source of truth for `MAX_TEXT_LENGTH`" check (`api/types.ts:70 = 5000`) was correct for the TS/Vite production path but the audit initially missed the legacy HTML+Babel entry (`Sentiment Analyzer.html` + 6 `.jsx` files), which carried its own `MAX_LEN = 2000` constant. Decision-log #12 had marked those for "deletion in a cleanup commit" once `phase-3-complete` was tagged. With the tag now in place, the cleanup is folded into Phase 4 to close out the dual-source ambiguity rather than leaving it for a separate commit:

- Deleted: `frontend/Sentiment Analyzer.html`, `frontend/src/App.jsx`, `frontend/src/hooks/useAnalysis.jsx`, `frontend/src/components/{Atoms,HistoryList,ResultsPanel,TextInput}.jsx`.
- Simplified `frontend/vite.config.ts`: removed the `resolve.extensions` reorder (was needed only to make `@/App` resolve to `App.tsx` instead of `App.jsx`; with `.jsx` gone, default Vite resolution is fine).
- Updated comment in `frontend/src/test/handlers.ts` that referenced the deleted `useAnalysis.jsx`.

Verification: typecheck clean, lint clean, `npm test` 108 passed, `npm run e2e` 5 passed (113 total — same count as before the cleanup), prod build still 47 modules / 217 KB JS / 13 KB CSS. The bundle does not regress because the legacy entry was never reachable from the Vite build graph.

§6 audit finding (separate, no code change): `frontend/src/api/client.ts` lines 91-95 map 429 to `kind: 'throttled'` before any body parse; `client.test.ts` proves `bodyRead === false`, which covers all body shapes (empty, AWS-XML, non-JSON) the spec asked about. No mismap.

§7 live-only checkboxes (5000-char paste end-to-end, 5001-char DevTools-console fetch → 422) remain deferred to the live-deploy turn.

---

## 2026-05-10 — Phase 4 closeout: live matrix, favicon fix, ready to tag

Live integration matrix completed against `https://asdfghjklzxc123.github.io/Sentiment-Analyzer/`. Detailed evidence — driver + observation for each live-reproducible `ApiError.kind`, plus documented deviations and unit-test references for the non-reproducible ones (`parse`, `server` 5xx, `throttled` 429) — recorded in `docs/phase4-results.md`. Browser matrix (Chrome + Safari), §11 acceptance walkthrough, and deviations are in there too. Notes captured here are the decisions, not the measurements.

1. **Browser-driven 429 handled as a documented deviation from §11 item 6** (`phase4-results.md` deviation #1). Two Pages-console saturation runs (12 chains × 12 s; 30 chains × 15 s) returned only 200s — Chrome's per-origin fetch concurrency cap kept the in-flight count below the AWS account ceiling. A Node 22 saturation at 30 chains × 15 s reliably hit 84% 429s on the same Function URL, and a sampled 429 response carried `Access-Control-Allow-Origin: https://asdfghjklzxc123.github.io` + `Vary: Origin`. Neither §11 alternative cleanly applies: path A (saturating run produces `kind:'throttled'`) failed because the browser self-throttled before AWS engaged; path B (missing-CORS-headers risk hit and documented) does not apply because the 429 response **does** carry CORS headers. Honest framing: browser could not surface `kind:'throttled'`, Node proved AWS 429 + CORS headers, mapping is unit-tested in `client.test.ts:142-158`. Recording as a deviation rather than retrying with ever-more-aggressive browser scripts.

2. **Phase 2 deviation #1 ("account concurrency cap = 10") is stale.** Sustained ~36 RPS without throttling in the Node saturation evidence implies AWS has raised the account quota since Phase 2. Informational only — no Phase 4 code change — but worth a note for any Phase 6 docs reconciliation.

3. **Favicon fix shipped** (`frontend/index.html`). Browsers auto-request `/favicon.ico` against the document root; Pages serves the project at `/Sentiment-Analyzer/` so the request 404'd. First fix used `data:,` (empty data URI), which functionally suppressed the request but caused Safari Web Inspector to log "An error occurred trying to load the resource" when clicking the row in Network panel. Upgraded to `data:image/svg+xml;base64,…` of an empty 1×1 SVG document — Safari accepts it as a valid resource, click-error gone in both browsers, no real network request, no 404. Codex-reviewed "ready to adopt" before the redeploy. The strict reading of §1 non-goals would have pushed this to Phase 6 polish, but the spec intro allows "small fixes when needed to make live integration pass" — a console 404 muddied the hard-refresh evidence, so it counted.

4. **Loading-tier ladder confirmed live** (§5 item 3). A natural 9.36 s cold start during the post-revert warm-submit verification surfaced the Tier 3 "Warming up the model — this happens on the first request." caption end-to-end, then resolved to success. The 30 s timeout absorbed the cold init; the previously unit-tested ladder fired correctly in the deployed bundle.

5. **`kind:'timeout'` driven via TEMP debug bundle.** Codex revised my initial 3000 ms proposal to 1000 ms (warm p95 = 1568 ms means 3000 might not abort). Deployed `REQUEST_TIMEOUT_MS = 1_000` to gh-pages, captured the abort (Network: preflight 200 / 95 ms + POST `(canceled)` / 898 ms; banner: "That took longer than expected. The model may be cold — try again."), then reverted to 30 000 and redeployed. Final canonical bundle is `index-CoWO73-n.js` (matches the post-revert hash from local builds — clean revert, no drift).

6. **Phase 4 acceptance items 1-10 of §11 satisfied; item 11 (the tag) lands with this commit.** Local `main` is 1 commit ahead of `origin/main` (codex flagged this during the closeout review): the tag must follow `git push origin main` so it lands on the same commit publicly. Tagging procedure surfaced to the user; tag is not pushed without explicit authorization.

Phase 4 hands off a working live demo on canonical GitHub Pages with the full error-class matrix verified or documented. Phase 5 (`docs/phase4-integration.md` §12) becomes a packaging exercise: the manual `VITE_LAMBDA_URL=… vite build && gh-pages` flow, captured here in `README.md` and verified twice during this phase, ports directly to a GitHub Actions workflow.

---

## 2026-05-10 — Phase 5 closeout: CI/CD pipeline landed in four PRs

CI/CD pipeline landed across four PRs into `main` over 2026-05-10 (#1 pr-check, #2 deploy-frontend, #3 deploy-backend + OIDC trust policy, #4 §6.1 smoke retry fix; all rebase-and-merge). Workflows configured for: PR check (typecheck + lint + vitest + playwright + production build smoke), frontend deploy via `actions/deploy-pages`, backend deploy via OIDC + ECR push + Lambda `update-function-code` + retry-aware smoke. AWS auth is OIDC end-to-end; no long-lived keys in repo secrets. Frontend deploy path verified end-to-end ([run 25643731343](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25643731343), 33 s; Chrome + Safari hard-refresh confirmed live). Backend deploy path verified end-to-end ([run 25644688218](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644688218), 9m7s; smoke step caught the cold-start 502 on attempt 1, returned 200 on attempt 2 after 15 s sleep; Lambda `Code.ImageUri` now `…/sentiment-analyzer:f55ad509…`). Branch protection on `main` enabled. Full results table in `docs/phase5-results.md`.

1. **§6.1 smoke test switched from option (a) to a bounded variant of option (b).** Plan §6.1 picked `--max-time 90` (option a) on the implicit assumption that curl was the bottleneck — i.e., the function would eventually respond and we'd just need to wait. The first `deploy-backend` run on `main` ([25644219764](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644219764)) falsified that: the first invocation after `update-function-code` lands on a Lambda host that hasn't cached the new image SHA, image pull + cold init exceeds the function's **30 s timeout**, AWS returns 502 fast, and curl just records the 502 — `--max-time 90` never engages because the function (not the connection) is what fails. This is Phase 2 deviation #7 reappearing in CI's first-invocation slot. Switched in PR [#4](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/pull/4) to **up to 3 attempts with 15 s sleep between failures**. Each attempt caches the image on the Lambda host regardless of 200 vs. timeout-kill, so retry #2 generally falls inside the 30 s timeout (warm init ~10 s). If all 3 fail, the smoke truly fails — broken image, not cold-start flake. The plan's stated concern with option (b) ("hides intermittent real failures") is bounded by the 3-attempt cap.

2. **§8 Lambda resource-policy tightening deferred again, per the plan's own fallback clause.** Local AWS CLI is 2.27.20; the `--invoked-via-function-url` flag needs 2.30+. The `lambda:InvokeFunction` grant remains permissive (anyone with the function ARN could `Invoke` directly), but the public-internet exposure is gated by the URL ARN per Phase 2 deviation #5. Phase 6 picks this up if/when the CLI is upgraded.

3. **Pages source flipped from `gh-pages` branch to "GitHub Actions" via `gh api`.** `gh api -X PUT /repos/ASDFGHJKLZXC123/Sentiment-Analyzer/pages -F build_type=workflow` between PR #2 land + merge, per plan §5.3. UI click-path equivalent recorded in `phase5-results.md`. Old `gh-pages` branch preserved as the documented fallback; can be deleted at maintainer discretion.

4. **One-off admin IAM user (`sentiment-admin`) created for §3 setup.** `sentiment-dev` has `IAMReadOnlyAccess` only (Phase 1 v2 + Phase 2 deviation #1), so the OIDC provider + role + inline policy were created under a new IAM user `sentiment-admin` with `AdministratorAccess`, configured as the `sentiment-admin` CLI profile. Access key can be deactivated post-phase to remove the admin footprint without deleting the user. Same pattern as Phase 2's "IAM role created via root console" deviation (entry 2026-05-06 #1) — admin-tier work happens off the deploy identity.

5. **Permissions policy (`cicd-deploy`) attached inline but not committed alongside the trust policy.** Plan §3 explicitly committed `backend/iam/github-actions-trust.json` for reproducibility. The inline permissions policy (`ecr:GetAuthorizationToken` on `*`, six ECR-push actions on the repo, `lambda:UpdateFunctionCode` + `lambda:GetFunction` on the function) was put via CLI but not also written to `backend/iam/`. Adding `github-actions-policy.json` is a small Phase 6 follow-up if reproducible bring-up is wanted.

6. **Phase 5 §10 acceptance items 1–10 satisfied; item 11 (`phase-5-complete` tag) lands immediately after this commit.** Evidence by item: 1 = OIDC provider + `github-actions-cicd` role created; `vars.AWS_ROLE_ARN` set. 2 = `pr-check` workflow green on each of PR #1–#4. 3 = `deploy-frontend` workflow on `main` + curl confirms HTML/JS/CSS 200 + `VITE_LAMBDA_URL` inlined + Chrome and Safari hard-refresh confirmed. 4 = `build_type=workflow`. 5 = ECR has image SHA `f55ad509…` and Lambda `Code.ImageUri` matches. 6 = run [25644688218](https://github.com/ASDFGHJKLZXC123/Sentiment-Analyzer/actions/runs/25644688218) smoke step recorded attempt 1 → 502, sleep 15 s, attempt 2 → 200 + jq pass. 7 = `gh api -X PUT /repos/.../branches/main/protection` returned the requested settings (required `pr-check` context, strict up-to-date, required PR review with `enforce_admins: false` so the maintainer can self-merge, no force-push, no deletion). 8 = `docs/phase5-results.md` exists with all run URLs filled in. 9 = this entry. 10 = per-PR `pr-check` ran 108 vitest + 5 playwright + typecheck + lint + build smoke green on each of #1–#4.

Phase 5 hands off a deploy pipeline where pushing to `main` ships to production. Phase 6 inherits the open carry-overs listed in `docs/phase5-results.md` Hand-off section.

---

## 2026-05-10 — Phase 6 §3: Phase 2 concurrency-cap deviation reconciled

The 2026-05-06 "Phase 2 deploy: account-quota and AWS-API constraints" entry above (item #2 here; same item is "deviation #1" in `docs/phase2-results.md`) recorded an AWS account-wide concurrent-execution quota of **10**. Phase 4 saturation evidence (`docs/phase4-results.md` deviation #2, 2026-05-10) ran a Node 22 driver with 30 concurrent chains for a 15-second window and produced **548 × 200 + 2780 × 429** — i.e., sustained ~36 RPS without throttling before AWS started rejecting. The cap is therefore materially higher than 10; AWS has raised the account quota since Phase 2 (likely automatic given account aging).

Resolution per `docs/phase6-polish.md` §3: no fresh saturation test. The 2026-05-06 entry stands as historical record; current behavioral state is captured by Phase 4's evidence. The exact new cap is not measured because Phase 6 is polish, not capacity planning — Phase 7 (if it happens) can pin a precise number if bulk-CSV throughput requires it.

Impact on shipped behavior: none. Phase 2 explicitly chose not to set reserved concurrency on the function (the cap of 10 was its argument; the new higher cap removes the rationale entirely, but the not-set choice is still correct because we're not running close to either cap at portfolio traffic levels). No code or infra change.
