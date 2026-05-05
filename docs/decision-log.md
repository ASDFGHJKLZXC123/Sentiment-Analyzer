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
