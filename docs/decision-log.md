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
