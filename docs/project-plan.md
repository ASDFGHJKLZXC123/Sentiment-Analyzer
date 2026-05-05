# Sentiment Analyzer Dashboard — Project Plan

This is the high-level roadmap for the project. It covers all phases from foundation through optional extensions.

For detailed, actionable specifications of each phase, see the corresponding `phaseN-*.md` document. This plan is the map; phase documents are the terrain.

## Document index

| Document | Purpose | Status |
|---|---|---|
| `project-plan.md` (this file) | High-level roadmap, all phases | Current |
| `phase1-foundation.md` | Decision record + setup checklist for Phase 1 | Created |
| `phase2-backend.md` | Backend build details | Pending |
| `phase3-frontend.md` | Frontend build details | Pending |
| `phase4-integration.md` | Integration details | Pending |
| `phase5-cicd.md` | CI/CD pipeline details | Pending |
| `phase6-polish.md` | Portfolio-readiness details | Pending |
| `phase7-bulk.md` | Optional bulk CSV feature details | Pending |
| `decision-log.md` | Running log of architectural decisions | Living document |

## Project summary

A sentiment analysis dashboard where users paste text and receive sentiment, emotion breakdown, keyword extraction, and session history. The ML model runs serverlessly on AWS Lambda; the dashboard is a React + TypeScript single-page app deployed via Git-based CI/CD.

The portfolio value of this project is demonstrating end-to-end ML deployment — not just training a model, but shipping it to production with a polished UI and automated deployment.

## Tech stack at a glance

- **Frontend:** React 19 + TypeScript, built with Vite, hosted on GitHub Pages
- **Local Node runtime:** Node.js 22 LTS
- **Backend:** Python 3.13 on AWS Lambda (container deployment), Hugging Face Transformers
- **API:** Lambda Function URL (no API Gateway)
- **CI/CD:** GitHub Actions with OIDC-based AWS authentication

For finalized model choices, deployment configuration, and full reasoning, see `phase1-foundation.md`.

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

**Detailed spec:** `phase1-foundation.md`

---

## Phase 2: Backend — Python ML on Lambda

**Goal:** Build and deploy the inference Lambda that powers the dashboard.

**Scope:**
- Python inference logic (sentiment + emotion + keyword extraction)
- Dockerfile for Lambda container image
- Lambda function configuration (memory, timeout, environment variables)
- Lambda Function URL with CORS
- Cold start strategy and warm-path performance validation
- API contract finalized and documented

**Output:** A live Lambda Function URL that accepts text and returns structured analysis results.

**Detailed spec:** `phase2-backend.md` (to be created)

---

## Phase 3: Frontend — React + TypeScript dashboard

**Goal:** Build the dashboard UI that consumes the Lambda API.

**Scope:**
- Vite + React + TypeScript scaffolding
- Component architecture (input, results, emotion chart, word cloud, history)
- API integration layer with loading and error states
- localStorage-based history persistence
- Responsive layout for desktop and mobile
- Visual design language (color coding, typography, charts)

**Output:** A locally-running React app that can call the Lambda and render results.

**Detailed spec:** `phase3-frontend.md` (to be created)

---

## Phase 4: Integration

**Goal:** Connect frontend to backend and harden the full system.

**Scope:**
- End-to-end testing across the deployed stack
- Error handling for cold starts, timeouts, network failures
- Input validation on both sides (length limits, language detection)
- All UI states fully designed (empty, typing, loading, success, error)

**Output:** A working live demo that handles edge cases gracefully.

**Detailed spec:** `phase4-integration.md` (to be created)

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

**Detailed spec:** `phase5-cicd.md` (to be created)

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

**Detailed spec:** `phase6-polish.md` (to be created)

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

**Detailed spec:** `phase7-bulk.md` (to be created)

**Note:** This phase is optional. Skip if scope or time becomes a concern; the v1 product is complete without it.

---

## Workflow notes

**When starting a new phase:** Generate the detailed phase document before beginning work. The document captures decisions and prevents drift.

**When making architectural decisions:** Append an entry to `decision-log.md` with the date, the decision, the alternatives considered, and the reasoning. This becomes interview material later.

**When a phase is complete:** Tag a commit with `phase-N-complete` so you can always return to a known-good state.

**If scope creep appears:** Refer back to the explicit "not building" list in `phase1-foundation.md`. Adding scope mid-build is the most common reason small projects stall.
