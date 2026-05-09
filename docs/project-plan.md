# Sentiment Analyzer Dashboard — Project Plan

This is the high-level roadmap for the project. It covers all phases from foundation through optional extensions.

For detailed, actionable specifications of each phase, see the corresponding `docs/phaseN-*.md` document. This plan is the map; phase documents are the terrain.

## Document index

Paths are repo-root relative.

| Document | Purpose | Status |
|---|---|---|
| `docs/project-plan.md` (this file) | High-level roadmap, all phases | Current |
| `docs/phase1-foundation.md` | Decision record + setup checklist for Phase 1 | Created |
| `docs/phase2-backend.md` | Backend build details | Created |
| `docs/phase2-results.md` | Phase 2 image size and performance measurements | Created |
| `docs/phase3-frontend.md` | Frontend stabilization details | Pending |
| `docs/phase4-integration.md` | Integration details | Created |
| `docs/phase5-cicd.md` | CI/CD pipeline details | Pending |
| `docs/phase6-polish.md` | Portfolio-readiness details | Pending |
| `docs/phase7-bulk.md` | Optional bulk CSV feature details | Pending |
| `docs/decision-log.md` | Running log of architectural decisions | Living document |

## Project summary

A sentiment analysis dashboard where users paste text and receive sentiment, emotion breakdown, keyword extraction, and session history. The ML model runs serverlessly on AWS Lambda; the dashboard is a React + TypeScript single-page app deployed via Git-based CI/CD.

The portfolio value of this project is demonstrating end-to-end ML deployment — not just training a model, but shipping it to production with a polished UI and automated deployment.

## Tech stack at a glance

- **Frontend:** React 19 + TypeScript, built with Vite, hosted on GitHub Pages
- **Local Node runtime:** Node.js 22 LTS (Maintenance LTS; deliberately chosen over Node 24 Active LTS for ecosystem maturity)
- **Backend:** Python 3.13 on AWS Lambda (container deployment), Hugging Face Transformers
- **API:** Lambda Function URL (no API Gateway)
- **CI/CD:** GitHub Actions with OIDC-based AWS authentication

For finalized model choices, deployment configuration, and full reasoning, see `docs/phase1-foundation.md`.

---

## Phase 1: Foundation and setup

**Goal:** Lock in technical decisions, prepare local and cloud environments, validate model choices.

**Scope:**
- Repository structure and Git setup
- Local development environment (Node, Python, Docker, AWS CLI)
- AWS account preparation with billing alerts
- Model selection and local validation
- Deployment path verification (Docker build smoke test)

**Output:** A configured repository, working local environment, validated model choices, and a tagged `phase-1-complete` commit.

**Detailed spec:** `docs/phase1-foundation.md`

---

## Phase 2: Backend — Python ML on Lambda

**Goal:** Build and deploy the inference Lambda that powers the dashboard.

**Scope:**
- Python inference logic (sentiment + emotion + keyword extraction)
- Dockerfile for Lambda container image
- Lambda function configuration (memory, timeout, environment variables, model revision SHAs)
- Lambda Function URL with CORS
- Cold start strategy and warm-path performance validation
- API contract finalized and documented

**Output:** A live Lambda Function URL that accepts text and returns structured analysis results, with image-size and latency measurements recorded in `docs/phase2-results.md`.

**Detailed spec:** `docs/phase2-backend.md`

---

## Phase 3: Frontend Stabilization — Upgrade low-fi UI to React + TypeScript dashboard

**Goal:** Upgrade the existing low-fi frontend into a typed, tested, accessible React + TypeScript dashboard.

**Scope:**
- Audit the existing low-fi frontend before refactoring or replacing anything
- Preserve working low-fi behavior where possible
- Migrate or align the frontend with the target Vite + React + TypeScript structure
- Component architecture: input, results panel, sentiment badge, emotion chart, keyword chips, history
- Typed API integration layer with loading, error, retry, and timeout states
- Mock-first API development with MSW fixtures matching the Phase 2 backend contract
- One lightweight live Lambda contract sanity check before phase completion
- localStorage-based history persistence
- Responsive layout for desktop and mobile
- Visual design language: color coding, typography, charts, weighted keyword chips
- Frontend test strategy: Vitest + React Testing Library for components, hooks, and API-state handling
- Browser and accessibility checks: Playwright smoke tests, axe checks, semantic HTML, and keyboard navigation

**Output:** The existing low-fi frontend has been stabilized into a locally running dashboard that renders all required UI states against mocked API responses, has a typed client ready for the Lambda Function URL, and has completed one live contract sanity check. Full deployed frontend/backend integration belongs to Phase 4.

**Detailed spec:** `docs/phase3-frontend.md`

---

## Phase 4: Integration

**Goal:** Connect the stabilized frontend to the deployed backend and harden the full system.

**Scope:**
- Replace mock usage with the real deployed Lambda Function URL
- Validate browser CORS behavior against the Lambda Function URL
- End-to-end testing across the deployed stack
- Error handling for cold starts, timeouts, network failures, malformed responses, 4xx responses, and 5xx responses
- Input validation on both sides (length limits, language detection if included in backend scope)
- Validate all UI states against real backend behavior: empty, typing, loading, success, error, retry-after-error, selected history

**Output:** A working live demo candidate that handles deployed-system edge cases gracefully.

**Detailed spec:** `docs/phase4-integration.md` (to be created)

---

## Phase 5: CI/CD with Git

**Goal:** Automate deployment so every push to `main` ships to production.

**Scope:**
- Branch strategy (main + feature branches)
- GitHub Actions workflows for PR checks and main deployment
- AWS authentication via OIDC (no long-lived credentials)
- Frontend deployment to GitHub Pages
- Backend deployment via container build and Lambda update
- Post-deploy smoke tests

**Output:** A fully automated pipeline; merging to `main` produces a deployed update without manual steps.

**Detailed spec:** `docs/phase5-cicd.md` (to be created)

---

## Phase 6: Polish and portfolio readiness

**Goal:** Make the project recruiter-ready.

**Scope:**
- Comprehensive README with screenshots and architecture overview
- Clean, shareable demo URL
- Pre-loaded demo content (one-click examples that showcase the model)
- Performance baseline documentation (cold start, warm response, accuracy notes)
- Cost monitoring confirmation

**Output:** A portfolio link that demonstrates the project clearly to a recruiter in under two minutes.

**Detailed spec:** `docs/phase6-polish.md` (to be created)

---

## Optional Phase 7: Bulk CSV upload

**Goal:** Add batch processing capability for CSV uploads.

**Scope:**
- Async architecture decision (long Lambda invocation vs. job queue)
- File upload handling
- Progress feedback to user
- Aggregate visualizations across batch results
- Result export as downloadable CSV

**Output:** A bulk upload feature that processes hundreds of rows and produces aggregate insights.

**Detailed spec:** `docs/phase7-bulk.md` (to be created)

**Note:** This phase is optional. Skip if scope or time becomes a concern; the v1 product is complete without it.

---

## Workflow notes

**When starting a new phase:** Generate the detailed phase document before beginning work. The document captures decisions and prevents drift.

**When making architectural decisions:** Append an entry to `decision-log.md` with the date, the decision, the alternatives considered, and the reasoning. This becomes interview material later.

**When a phase is complete:** Tag a commit with `phase-N-complete` so you can always return to a known-good state.

**If scope creep appears:** Refer back to the explicit "not building" list in `docs/phase1-foundation.md`. Adding scope mid-build is the most common reason small projects stall.
