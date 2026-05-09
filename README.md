# Sentiment Analyzer Dashboard

A web dashboard that analyzes text and returns sentiment, emotion breakdown, and keyword extraction. Inference runs on AWS Lambda; the frontend is a React + TypeScript single-page app.

> Status: Phase 2 complete. Backend Lambda is deployed; frontend work is next.

## Screenshot

_Placeholder — screenshot added in Phase 6._

## Live demo

_Placeholder — URL added once deployed via GitHub Pages in Phase 5._

## Tech stack

- **Frontend:** React 19 + TypeScript, built with Vite, hosted on GitHub Pages
- **Backend:** Python 3.13 on AWS Lambda (container image), Hugging Face Transformers
- **API:** Lambda Function URL (HTTPS, no API Gateway)
- **CI/CD:** GitHub Actions with OIDC-based AWS authentication
- **Region:** `us-east-1`

### Models

- Sentiment: `cardiffnlp/twitter-roberta-base-sentiment-latest`
- Emotion: `j-hartmann/emotion-english-distilroberta-base`
- Keywords: YAKE (statistical, non-ML)

## Repository layout

```
.
├── frontend/                # React + TypeScript app
├── backend/                 # Python Lambda code + Dockerfile
│   ├── explore/             # Throwaway model-exploration scripts
│   └── test_inputs.json     # 24-case English test corpus
├── .github/workflows/       # CI/CD pipelines
└── docs/
    ├── project-plan.md      # High-level roadmap
    ├── phase1-foundation.md # Phase 1 decisions + checklist
    ├── decision-log.md      # Running architectural decisions
    └── model-evaluation.md  # Test corpus results
```

## Local setup

### Prerequisites

- Node.js 22 LTS (via nvm)
- Python 3.13 (via pyenv)
- Docker Desktop
- AWS CLI v2 configured for `us-east-1`

### Frontend

```bash
cd frontend
npm install
npm run dev
```

`npm run dev` reads `VITE_LAMBDA_URL` (default `/api/analyze`); the dev proxy in `vite.config.ts` forwards that prefix to the deployed Function URL so the browser stays same-origin and avoids the CORS allowlist (which is locked to the Pages origin).

#### Production build

The production bundle is served from GitHub Pages at `https://asdfghjklzxc123.github.io/Sentiment-Analyzer/`, so two build inputs matter:

- `VITE_LAMBDA_URL` — absolute Function URL inlined into the bundle at build time (no runtime proxy on Pages). Required.
- Vite `base` — set to `/Sentiment-Analyzer/` in `vite.config.ts` so asset URLs resolve under the Pages path.

```bash
cd frontend
VITE_LAMBDA_URL=https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/ npm run build
npm run preview   # local smoke for assets/inlining only — NOT a CORS check
```

CORS validation has to happen from the deployed Pages origin; `localhost:4173` is not in the Lambda's `AllowOrigins`. Phase 5 will automate this build + `gh-pages` push in CI.

### Backend (model exploration)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements-dev.txt
python explore/explore_models.py
```

### Backend (Lambda container build)

```bash
cd backend
docker build -t sentiment-analyzer .
docker run --rm -p 9000:8080 sentiment-analyzer
# In another terminal:
curl -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -d '{"body": "{\"text\": \"I love this!\"}"}'
```

## Architecture summary

```
   Browser (GitHub Pages)
        │  HTTPS (CORS)
        ▼
   Lambda Function URL
        │
        ▼
   Lambda (container, ARM64, 3008 MB)
        ├─ sentiment model (RoBERTa)
        ├─ emotion model (DistilRoBERTa)
        └─ YAKE keyword extraction
```

The browser POSTs `{"text": "..."}` to the Function URL. Lambda returns JSON with sentiment, emotion probabilities, and keywords. History is persisted client-side in `localStorage`.

For full API contract see [`docs/phase1-foundation.md`](docs/phase1-foundation.md).

## Roadmap

See [`docs/project-plan.md`](docs/project-plan.md). Current phase: Phase 3 (frontend).

## License

MIT — see [`LICENSE`](LICENSE).
