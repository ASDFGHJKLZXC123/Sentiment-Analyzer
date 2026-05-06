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
