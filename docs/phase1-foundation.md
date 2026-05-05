# Sentiment Analyzer Dashboard — Phase 1: Foundation (v3)

This document is the source of truth for Phase 1 decisions and setup. It has two parts:

1. **Decision Record** — locks in the technical choices and the reasoning behind them. Treat this as immutable unless a decision is explicitly revisited.
2. **Setup Checklist** — concrete, ordered actions to complete Phase 1.

Items marked **[YOU]** require your personal accounts, credentials, or local machine and cannot be delegated.

**Revision note:** This is v3. Changes from v1 and v2 are logged in `decision-log.md`. Earlier versions are kept in Git history for traceability.

---

## Part 1: Decision Record

### Project scope

**Building:**
- React + TypeScript dashboard for sentiment analysis
- Python ML inference on AWS Lambda using Hugging Face Transformers
- Single text input → sentiment + emotion + keyword results
- Session-local analysis history (browser localStorage)
- Git-based CI/CD pipeline

**Explicitly not building (in v1):**
- User accounts or authentication
- Server-side history persistence
- Multi-language support — English only
- Bulk CSV upload (deferred to optional Phase 7)
- Custom domain
- Mobile native apps

### Naming and identifiers

| Item | Value |
|---|---|
| Repository slug | `sentiment-analyzer` (lowercase, hyphenated) |
| Human-readable project name | "Sentiment Analyzer Dashboard" |
| Default branch | `main` |
| AWS region | `us-east-1` |

### Technical stack

| Layer | Choice |
|---|---|
| Frontend framework | React 19 + TypeScript |
| Frontend build tool | Vite (latest) |
| Frontend hosting | GitHub Pages |
| Node.js runtime (local + CI) | 22 LTS |
| Backend runtime | Python 3.13 on AWS Lambda |
| Backend deployment format | Container image via Lambda container support |
| Lambda base image | `public.ecr.aws/lambda/python:3.13` (ARM64) |
| ML library | Hugging Face Transformers + PyTorch |
| API protocol | Lambda Function URL (HTTPS, no API Gateway) |
| CI/CD | GitHub Actions |
| AWS authentication from CI | OIDC (no long-lived access keys) |

### Model selection

**Sentiment model:** `cardiffnlp/twitter-roberta-base-sentiment-latest`
- Three-way output (positive/negative/neutral) matches dashboard UI
- Trained on Twitter data — handles informal text well
- ~500 MB

**Emotion model:** `j-hartmann/emotion-english-distilroberta-base`
- Seven categories (anger, disgust, fear, joy, neutral, sadness, surprise)
- Right granularity for chart visualization
- ~330 MB

**Keyword extraction:** YAKE (statistical, non-ML)
- ~5 MB, no neural model required
- Word cloud doesn't need ML-quality keywords
- Avoids loading a third model

### Deployment path

**Lambda container image** to ECR.
- Combined model weights (~830 MB) plus PyTorch (~800 MB) exceed Lambda's 250 MB zip limit
- Container path supports up to 10 GB; total image will land around 2–3 GB
- Flexibility to swap models or add features later without re-architecting deployment

### API contract

**Endpoint:** `POST` to Lambda Function URL

**Request body:**
```json
{
  "text": "string"
}
```

**Response body:**
```json
{
  "sentiment": {
    "label": "positive | negative | neutral",
    "confidence": 0.873
  },
  "emotions": {
    "anger": 0.02,
    "disgust": 0.01,
    "fear": 0.03,
    "joy": 0.78,
    "neutral": 0.10,
    "sadness": 0.04,
    "surprise": 0.02
  },
  "keywords": [
    { "term": "amazing", "weight": 0.92 },
    { "term": "service", "weight": 0.71 }
  ],
  "inputText": "echoed input text",
  "analyzedAt": "2026-05-04T12:34:56Z"
}
```

**Conventions:**
- All keys are camelCase. Single-word keys (`sentiment`, `emotions`, `keywords`, `label`, `confidence`, `term`, `weight`) are unchanged. Multi-word keys use camelCase (`inputText`, `analyzedAt`).
- Confidence and emotion values are probabilities (0–1), formatted by frontend
- Sentiment labels are human-readable strings, mapped from raw model output in Python
- `analyzedAt` is server-side, ISO 8601, UTC

### Lambda configuration

| Setting | Value |
|---|---|
| Architecture | ARM64 (Graviton — cheaper, well-supported) |
| Memory | 2048 MB |
| Timeout | 30 seconds |
| Function URL | Enabled, CORS allowing GitHub Pages domain |
| Environment variables | `SENTIMENT_MODEL`, `EMOTION_MODEL` (for swap-without-rebuild) |

### IAM strategy

**Phase 1 development user:** Use AWS managed policies for fast iteration.
- `AWSLambda_FullAccess`
- `AmazonEC2ContainerRegistryFullAccess`
- `CloudWatchLogsFullAccess`
- `IAMReadOnlyAccess`

**Phase 5 CI/CD role:** Custom least-privilege policy via OIDC trust to GitHub Actions. Defined when Phase 5 begins. The dev user staying broad is fine because it is MFA-protected and used only locally; the CI role is where IAM expertise is demonstrated.

### Repository structure

```
sentiment-analyzer/
├── frontend/                 # React + TypeScript app
├── backend/                  # Python Lambda code + Dockerfile
├── .github/workflows/        # CI/CD pipelines
├── docs/
│   ├── project-plan.md       # High-level roadmap
│   ├── phase1-foundation.md  # This document
│   ├── decision-log.md       # Running architectural decisions
│   └── model-evaluation.md   # Test corpus results, created in Section F
├── .gitignore                # Covers Node + Python + Docker + IDE files
├── LICENSE                   # MIT
└── README.md                 # Top-level project overview
```

### Test corpus structure

Stored at `backend/test_inputs.json`. All inputs are English. Twenty-four cases covering:

| Category | Count | What it tests |
|---|---|---|
| Clear positive | 3 | Baseline correctness |
| Clear negative | 3 | Baseline correctness |
| Neutral / factual | 3 | Use of neutral category |
| Sarcastic | 3 | Known weakness — documented honestly |
| Mixed sentiment | 3 | Multi-aspect handling |
| Negation | 2 | Logical understanding ("not bad at all") |
| Internet shorthand | 2 | Modern informal text ("lmao this is fire ngl") |
| Edge cases | 5 | Single word, single emoji, all caps, very long, empty string |

Non-English inputs were intentionally excluded. The chosen models are English-only; out-of-distribution input produces noise rather than meaningful test signal, and cannot be evaluated without language expertise.

### Success criteria for Phase 1

Phase 1 is complete when:
- [ ] Repository exists on GitHub with the structure above, on the `main` branch
- [ ] Local Node and Python environments are working (Node 22 LTS, Python 3.13)
- [ ] AWS account is configured with billing alert
- [ ] Both models have been downloaded and tested locally with the test corpus
- [ ] Decision log entry is written for the model choices
- [ ] Frontend hosting target (GitHub Pages) is confirmed
- [ ] Deployment path (container) is confirmed by successful local Docker build of an empty test image

---

## Part 2: Setup Checklist

Work through these in order. Do not skip ahead — later steps depend on earlier ones.

### Section A: Local development environment

- [ ] **[YOU]** Install `nvm` (Node Version Manager) for your OS
- [ ] **[YOU]** Install Node.js 22 LTS via nvm: `nvm install 22 && nvm use 22`
- [ ] **[YOU]** Install `pyenv` (Python Version Manager) for your OS
- [ ] **[YOU]** Install Python 3.13 via pyenv: `pyenv install 3.13 && pyenv global 3.13`
- [ ] **[YOU]** Install Docker Desktop (required for container deployment path)
- [ ] **[YOU]** Verify Docker runs: `docker run hello-world`
- [ ] **[YOU]** Install Git and verify version is 2.30+
- [ ] **[YOU]** Configure Git identity globally with your real name and the email associated with your GitHub account
- [ ] **[YOU]** Install AWS CLI v2
- [ ] **[YOU]** Install your editor of choice with TypeScript, Python, ESLint, Prettier, and Ruff extensions

### Section B: GitHub setup

- [ ] **[YOU]** Confirm GitHub account exists with the email matching your Git identity
- [ ] **[YOU]** Enable two-factor authentication on GitHub if not already enabled
- [ ] **[YOU]** Create (or rename existing) public repository as `sentiment-analyzer`
- [ ] **[YOU]** Initialize the repository with a README, MIT license, and no `.gitignore` (a custom one is added in Section C)
- [ ] **[YOU]** If the repository was initialized on `master`, rename to `main`:
  ```
  git branch -m master main
  git push -u origin main
  ```
  Then set `main` as the default branch in GitHub Settings and delete the old `master` branch on the remote.
- [ ] **[YOU]** Clone the repository to your local machine

### Section C: Repository scaffolding

- [ ] Create top-level folders: `frontend/`, `backend/`, `docs/`, `.github/workflows/`
- [ ] Add a multi-language `.gitignore` covering Node, Python, Docker, and common IDE files
- [ ] Replace the auto-generated README with a project overview written from scratch covering: one-line description, screenshot placeholder, live demo link placeholder, tech stack, local setup instructions, architecture summary. Real content fills in during Phase 6; placeholders are fine for now.
- [ ] Add `docs/project-plan.md` (the high-level roadmap)
- [ ] Add `docs/phase1-foundation.md` (this document)
- [ ] Add `docs/decision-log.md` and seed it with the first entry: a summary of the technical choices in this Decision Record and the reasoning
- [ ] Commit and push: "Phase 1: initial repository scaffolding"

### Section D: AWS account preparation

- [ ] **[YOU]** Create an AWS account if one does not exist, or log into your existing personal account
- [ ] **[YOU]** Enable MFA on the root account immediately
- [ ] **[YOU]** Confirm there are no access keys on the root account; if any exist, delete them
- [ ] **[YOU]** Create an IAM user named `sentiment-dev` with programmatic and console access
- [ ] **[YOU]** Attach these AWS managed policies to the IAM user:
  - `AWSLambda_FullAccess`
  - `AmazonEC2ContainerRegistryFullAccess`
  - `CloudWatchLogsFullAccess`
  - `IAMReadOnlyAccess`
- [ ] **[YOU]** Enable MFA on the IAM user
- [ ] **[YOU]** Generate an access key pair for the IAM user; save it in a password manager (NEVER commit to Git)
- [ ] **[YOU]** Run `aws configure` locally with the access keys and region `us-east-1`
- [ ] **[YOU]** Verify access: `aws sts get-caller-identity` returns the IAM user ARN
- [ ] **[YOU]** Set up a billing alert at $5/month threshold via CloudWatch Billing (must be done in `us-east-1`)
- [ ] **[YOU]** Confirm the alert email arrives in your inbox by testing the SNS subscription

### Section E: Model exploration

- [ ] Create `backend/explore/` as a scratch directory (not part of the deployable code)
- [ ] Set up a Python virtual environment in `backend/`: `python -m venv .venv` (uses Python 3.13 via pyenv)
- [ ] Activate the virtual environment
- [ ] Install Transformers, PyTorch (CPU version), and YAKE
- [ ] Write a one-off script that loads both models and runs them on sample inputs
- [ ] Confirm the sentiment model outputs three labels with probabilities summing to ~1
- [ ] Confirm the emotion model outputs seven categories with probabilities summing to ~1
- [ ] Confirm YAKE extracts reasonable keywords from sample text
- [ ] Note the size of each downloaded model (check `~/.cache/huggingface/`)
- [ ] Time how long inference takes for a single input on your laptop

### Section F: Test corpus creation

- [ ] Create `backend/test_inputs.json`
- [ ] Add 3 clear positive examples
- [ ] Add 3 clear negative examples
- [ ] Add 3 neutral / factual examples
- [ ] Add 3 sarcastic examples (expect model failure here)
- [ ] Add 3 mixed-sentiment examples
- [ ] Add 2 negation examples (e.g., "not bad at all", "I can't stop using this")
- [ ] Add 2 internet-shorthand examples (e.g., "lmao this is fire ngl")
- [ ] Add edge cases: single word, single emoji, all caps, very long passage, empty string
- [ ] Run all examples through both models and record results in `docs/model-evaluation.md`
- [ ] Note any surprising failures explicitly in the evaluation doc — these become honest README content

### Section G: Deployment path verification

- [ ] Create a stub `backend/Dockerfile` based on `public.ecr.aws/lambda/python:3.13` (ARM64)
- [ ] Add a placeholder handler that returns a fixed JSON response (no model loading yet)
- [ ] Build the image locally: `docker build -t sentiment-analyzer-stub backend/`
- [ ] Verify the build succeeds and note the final image size
- [ ] Run the image locally and confirm the handler responds correctly
- [ ] Tear down the test image; this was a smoke test only

### Section H: Phase 1 closeout

- [ ] All checkboxes above are checked
- [ ] All Phase 1 success criteria in the Decision Record are met
- [ ] A commit on `main` tagged `phase-1-complete` exists
- [ ] Decision log is up to date
- [ ] You can articulate, out loud, why each major technical choice was made

When all of the above is done, Phase 1 is complete. Proceed to Phase 2: backend build.

---

## Reference: things to look up if you get stuck

- AWS Lambda container image documentation
- Hugging Face Transformers pipeline documentation
- Vite + React + TypeScript template guide
- GitHub Actions OIDC setup for AWS
- Lambda Function URL CORS configuration

## Reference: red flags during Phase 1

If any of these happen, stop and reconsider before continuing:

- Local model inference takes more than 5 seconds per request — your laptop may be too slow to develop comfortably; consider a smaller model
- Combined Docker image size exceeds 8 GB — something is wrong with layer caching
- AWS billing alert fires during Phase 1 — you have not deployed anything yet, so this means a misconfiguration
- A test input crashes either model — investigate before proceeding; production users will hit the same input class
- PyTorch installation fails on Python 3.13 — fall back to 3.12 and update the doc; ML library support on the latest Python sometimes lags
