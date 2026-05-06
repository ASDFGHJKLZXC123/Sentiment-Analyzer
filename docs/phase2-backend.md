# Phase 2: Backend — Python ML on Lambda (v4)

Detailed spec for Phase 2 of the Sentiment Analyzer Dashboard. Inherits the Phase 1 foundation decisions from `phase1-foundation.md` (v4) and the contract clarifications in `decision-log.md` (entry: 2026-05-06), then applies the Phase 2 contract revisions documented below.

**Revision note:** v4 applies the 2026-05-06 follow-up review pass: makes Dockerfile `ENV` model revision SHAs the single source of truth for build, runtime logging, and slow tests; makes the Transformers v5 smoke gate explicit; requires a direct `huggingface_hub` pin; expands deployment smoke tests to cover the public contract; adds `phase2-results.md`; tightens Lambda throttling and CORS language; and standardizes on `pip-compile`.

---

## Prerequisites — close Phase 1 first

The project plan's workflow notes require tagging `phase-N-complete` before moving on. Per `decision-log.md` (2026-05-05 status entry, confirmed 2026-05-06), Phase 1 is *not* complete:

- [ ] AWS billing alert at $5/month threshold (Section D, last two items)
- [ ] SNS subscription email confirmation
- [ ] Section H closeout: success criteria reviewed, decision log up to date
- [ ] `phase-1-complete` tag applied on `main` (`git tag --list` currently empty)

Do not start the Phase 2 work below until those items are closed. Phase 2 work assumes the Phase 1 environment is locked in.

---

## Goal

Implement the inference Lambda that satisfies the Phase 1 API contract. The output is a deployed Lambda Function URL the Phase 3 frontend will consume.

## What Phase 2 inherits without change

These come from Phase 1 and are not revisited here:

| Item | Source |
|---|---|
| Base API shape (request, 200 response, error envelope, camelCase, `keywords[].score` lower-is-better) | `phase1-foundation.md` §API contract; `decision-log.md` 2026-05-06. Phase 2 refines specific error statuses below. |
| Container deployment to ECR (not zip) | `phase1-foundation.md` §Deployment path |
| Base image: `public.ecr.aws/lambda/python:3.13` (ARM64, Amazon Linux 2023) | `phase1-foundation.md` §Technical stack, §Section G note |
| Models: `cardiffnlp/twitter-roberta-base-sentiment-latest`, `j-hartmann/emotion-english-distilroberta-base`, YAKE | `phase1-foundation.md` §Model selection |
| Lambda memory baseline 2048 MB, tune up to 3072 MB if needed | `phase1-foundation.md` §Lambda configuration |
| Lambda timeout 30 s, ARM64 | `phase1-foundation.md` §Lambda configuration |
| Env vars `SENTIMENT_MODEL`, `EMOTION_MODEL` (model IDs retained for observability/config labels; weights are baked into the image) | `phase1-foundation.md` §Lambda configuration; resolved by Phase 2 offline-mode decision |
| Function URL with CORS allowing GitHub Pages domain | `phase1-foundation.md` §Lambda configuration |
| AWS account `<account-id>`, region `us-east-1`, IAM dev user `sentiment-dev` (group `sentiment-dev-group`) | `phase1-foundation.md` §Naming, `decision-log.md` 2026-05-05. The real account ID is recorded in the decision log, not repeated in reusable command examples. |

## What Phase 2 newly decides

These things genuinely belong to Phase 2 because Phase 1 left them open:

### Pin transformers, torch, yake, and huggingface_hub to exact versions

Phase 1 used `transformers>=4.44` during exploration; the local exploration env actually has `transformers==5.7.0`, `torch==2.11.0`, `yake==0.7.3` (per `decision-log.md` 2026-05-04 entries). Phase 2 commits to one set of pins and stops drifting:

- Generate `requirements.txt` from `requirements.in` via `pip-compile` from `pip-tools` so all transitive pins are exact and lock-file diffs stay reproducible.
- Include `huggingface_hub` explicitly in `requirements.in` because the Dockerfile imports `snapshot_download` directly and Hub 1.x changed APIs from the 0.x line.
- Current Phase 2 candidate pins: `transformers==5.8.0` (current on 2026-05-06), `torch==2.11.0`, `yake==0.7.3`, `networkx==3.6.1`, plus one exact compatible `huggingface_hub==1.x.y` pin chosen during the Phase 2 dependency proof. Do not leave `huggingface_hub` to the resolver.
- `transformers==5.7.0` remains the Phase 1-verified fallback if `5.8.0` changes behavior or fails the container proof. Do not bump just because a newer release exists; bump only after the smoke checks below pass.
- Treat Transformers v5 as a major compatibility point. The two chosen models are standard RoBERTa/DistilRoBERTa architectures and should load, but Phase 2 must prove that with the deps-only import check and a slow smoke test that loads both local model snapshots and runs one inference.
- If compatibility forces a fallback to the latest 4.x line of `transformers`, check current security advisories and whether relevant fixes were backported before recommending it. Record the version, the security status, and the reason v5 was rejected in `decision-log.md`.
- Append the chosen pins and reasoning as a new `decision-log.md` entry before merging the Phase 2 backend code.

Before downloading the multi-GB model snapshots, run a deps-only container proof:

```
docker build --platform=linux/arm64 --target deps -t sentiment-analyzer:deps backend/
docker run --rm sentiment-analyzer:deps python -c "import torch, transformers, yake, networkx"
docker run --rm sentiment-analyzer:deps pip check
```

This catches Python 3.13 / Linux ARM64 wheel failures quickly, before the slow model-download layer.

### Pin model revisions, not just model names

Hugging Face model repos are mutable. Phase 1 named the models; Phase 2 nails them to specific commits so a model author's update can't change inference behaviour silently:

```python
from huggingface_hub import snapshot_download
snapshot_download(
    repo_id="cardiffnlp/twitter-roberta-base-sentiment-latest",
    revision="<sha-from-hf-commits-page>",
    local_dir="/opt/models/sentiment",
)
```

The exact full commit SHAs go into `decision-log.md` and Dockerfile `ENV` declarations:

```dockerfile
ENV SENTIMENT_MODEL_REVISION=<40-char-hugging-face-commit-sha>
ENV EMOTION_MODEL_REVISION=<40-char-hugging-face-commit-sha>
```

Those env vars are the single mechanism for model revision identity. The Dockerfile uses them for `snapshot_download(..., revision=os.environ["..."])`, and the handler reads them at module import time for cold-start logging. Do not duplicate the SHAs in a separate `MODEL_REVISIONS` comment block or Lambda configuration override. Do not pass `local_dir_use_symlinks`; it was removed in `huggingface_hub` v1.x, and `local_dir` downloads now materialize the requested file layout without that flag.

### Offline mode hardened (belt-and-suspenders)

Per Hugging Face docs, `HF_HUB_OFFLINE=1` is the canonical offline switch read by `huggingface_hub`; `TRANSFORMERS_OFFLINE=1` is the older Transformers-specific switch. Set both, plus pass `local_files_only=True` at load:

- Build-time: `snapshot_download(...)` writes weights to `/opt/models/{sentiment,emotion}`.
- Runtime env: `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `HF_HOME=/opt/hf-home`.
- Loader call: `AutoTokenizer.from_pretrained("/opt/models/sentiment", local_files_only=True)`.

This eliminates the freshness check that `hf_hub_download` otherwise makes on every load — a measurable cold-start win and a reliability win in offline-by-design Lambda execution environments.

### Reserved concurrency = 10

Cost guard during early development; a misconfigured loop or hostile traffic can't run up unbounded charges. Function URL has no built-in throttling, so reserved concurrency is the lever. Re-evaluate in Phase 6.

When reserved concurrency is exhausted, Lambda returns service-generated `429 Too Many Requests` before the handler runs. That response is part of the public behavior, but its body and headers are AWS-owned and outside the handler's JSON error envelope. The frontend should map any 429 from this endpoint to a `THROTTLED` user-facing state without assuming the `{"error": ...}` shape.

---

## API contract

This section starts from the Phase 1 contract and adds Phase 2 contract clarifications: non-`POST` methods return `405 METHOD_NOT_ALLOWED`, text-length violations return `422 INPUT_TOO_LONG`, validation precedence is fixed, and Lambda-generated `429` throttling is explicitly outside the handler envelope. Add a `decision-log.md` entry titled "Phase 2 contract revision" before merging implementation.

**Request:**
```json
{ "text": "string" }
```

**Response (200):**
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
    { "term": "Amazing experience", "score": 0.042 },
    { "term": "Amazing", "score": 0.201 }
  ],
  "inputText": "echoed input text (capped at 200 chars)",
  "analyzedAt": "2026-05-04T12:34:56Z"
}
```

**Error response (handler-owned 4xx):**
```json
{
  "error": {
    "code": "EMPTY_INPUT | INPUT_TOO_LONG | INVALID_JSON | METHOD_NOT_ALLOWED",
    "message": "Human-readable error message",
    "field": "text | method"
  }
}
```

| Code | HTTP | Trigger |
|---|---|---|
| `EMPTY_INPUT` | 400 | `text` missing, empty, or whitespace-only |
| `INPUT_TOO_LONG` | 422 | `text` exceeds 5000 characters |
| `INVALID_JSON` | 400 | Body is not valid JSON or not an object |
| `METHOD_NOT_ALLOWED` | 405 | HTTP method is not `POST`; response includes `Allow: POST` |

Notes carried from Phase 1:
- `keywords[].score` is the raw YAKE score; lower means more relevant. The frontend inverts/normalizes for visual sizing.
- `inputText` is server-side-echoed, capped at 200 characters.
- `analyzedAt` is ISO 8601, UTC, server-generated.
- Models internally truncate to their own input limits; the 5000-character ceiling is a payload guard, not a model limit.
- Language rejection is intentionally **not** a committed error code yet — Phase 2 hasn't chosen a detection mechanism. Non-English input produces noise; this is documented honestly rather than enforced.

Phase 2 intentionally uses `422` rather than `413` for `INPUT_TOO_LONG`: the JSON request can be syntactically valid and small enough for Lambda, while the parsed `text` field violates this API's business rule. A true platform-level body-size rejection, if it ever occurs before the handler runs, is outside the handler-owned envelope.

Service-generated response:
- `429 Too Many Requests`: returned by Lambda Function URL when reserved concurrency is exhausted. Treat as `THROTTLED` in clients, but do not assert the handler error-envelope shape in tests.

---

## Function URL event handling

Lambda Function URLs use the same request/response schema as API Gateway HTTP API payload format v2.0. The handler must treat the incoming event as an HTTP envelope, not as the raw `{ "text": "..." }` object:

- Read the HTTP method from `event["requestContext"]["http"]["method"]`.
- Reject non-`POST` methods with `405 METHOD_NOT_ALLOWED` and an `Allow: POST` response header.
- Read request JSON from `event["body"]`, which is a string.
- Respect `event["isBase64Encoded"]`; if true, base64-decode `body` before JSON parsing. Decode failures return `400 INVALID_JSON`.
- Treat missing `body`, malformed JSON, arrays, scalars, and parsed non-object values as `INVALID_JSON`.
- Return Lambda proxy responses with `statusCode`, `headers`, `body` as a JSON string, and `isBase64Encoded: false`.

Validation precedence is contractual and must be reflected in tests:

1. Method check.
2. Base64 decode, if `isBase64Encoded` is true.
3. JSON parse and object check.
4. Schema/business validation for `text` missing, empty, whitespace-only, wrong type, and too long.

Examples: a non-`POST` request with malformed JSON still returns `405 METHOD_NOT_ALLOWED`; a `POST` request with malformed JSON returns `400 INVALID_JSON` before any `text` validation; a valid JSON object with `text` over 5000 characters returns `422 INPUT_TOO_LONG`.

Do not manually add CORS headers in the function response. CORS is configured on the Function URL. For preflight requests such as `OPTIONS`, the configured Function URL CORS response takes precedence, so the handler does not need an `OPTIONS` branch.

---

## Repository layout

```
backend/
├── .dockerignore              # excludes local/dev-only files from image context
├── Dockerfile
├── requirements.in            # source pins
├── requirements.txt           # generated, exact resolved versions
├── lambda_function.py         # handler entry
├── inference/
│   ├── __init__.py
│   ├── sentiment.py           # cardiffnlp/twitter-roberta...
│   ├── emotion.py             # j-hartmann/emotion...
│   └── keywords.py            # YAKE wrapper
├── tests/
│   ├── conftest.py            # shared fixtures/mocks
│   ├── test_sentiment.py
│   ├── test_emotion.py
│   ├── test_keywords.py
│   ├── test_handler.py
│   └── test_validation.py
├── explore/                   # already exists from Phase 1; not deployed
└── README.md                  # local dev + manual deploy steps
```

The deployable code lives at `backend/`; `backend/explore/` (Phase 1 scratch) stays in the repo but is excluded from the image via `.dockerignore`.

`.dockerignore` should exclude `.venv/`, `__pycache__/`, `.pytest_cache/`, `explore/`, `tests/` if tests are not copied into the runtime image, `*.md` except files intentionally used at runtime, `.git/`, local timing artifacts, and downloaded model/cache directories that are not part of the Docker build.

---

## Container and runtime

### Dockerfile structure

- Base: `public.ecr.aws/lambda/python:3.13` (Amazon Linux 2023 — use `dnf` not `yum` if OS packages are needed).
- Use a named `deps` stage that installs pinned deps from `requirements.txt` with `pip install --no-cache-dir`; this stage is the fast dependency proof gate before model downloads.
- Declare full Hugging Face commit SHAs as `ENV SENTIMENT_MODEL_REVISION=<sha>` and `ENV EMOTION_MODEL_REVISION=<sha>`.
- Run `snapshot_download` for both models using those env vars as the pinned revisions, writing to `/opt/models/sentiment` and `/opt/models/emotion`.
- Copy application code under `${LAMBDA_TASK_ROOT}`.
- Set env: `HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `HF_HOME=/opt/hf-home`, `LOG_LEVEL=INFO`.
- `CMD ["lambda_function.handler"]`.

The `--platform=linux/arm64` flag is mandatory at build time per the v4 Section G note. The Phase 1-verified pins had working wheels locally; the Phase 2 candidate pins must prove Python 3.13 / Linux ARM64 compatibility in the deps-only image. If a chosen pin lacks an ARM64 cp313 wheel, that's a re-pin trigger, not an arch change.

### Image-size gate

Lambda container images have a 10 GB maximum uncompressed size, including all layers. The chosen ML stack should land well below that, but verify before pushing:

```
docker image inspect sentiment-analyzer:<git-sha> --format '{{.Size}}'
docker run --rm --entrypoint /bin/sh sentiment-analyzer:<git-sha> -c 'du -sh /opt/models/* /var/task'
```

Record total image size and per-model directory sizes in `phase2-results.md`. If the image approaches the limit, inspect dependency weight before changing architecture.

### Module-scope model loading

Loading happens at container init, not per-invocation. Long cold starts, fast warm path. Code shape:

```python
# inference/sentiment.py
from transformers import AutoTokenizer, AutoModelForSequenceClassification
import os

_MODEL_PATH = "/opt/models/sentiment"   # baked-in
_MODEL_ID   = os.environ["SENTIMENT_MODEL"]   # carried for logging/observability
_MODEL_REVISION = os.environ["SENTIMENT_MODEL_REVISION"]

tokenizer = AutoTokenizer.from_pretrained(_MODEL_PATH, local_files_only=True)
model     = AutoModelForSequenceClassification.from_pretrained(_MODEL_PATH, local_files_only=True)
model.eval()
```

The Phase 1 env vars (`SENTIMENT_MODEL`, `EMOTION_MODEL`) are kept and surfaced through logging. The revision env vars (`SENTIMENT_MODEL_REVISION`, `EMOTION_MODEL_REVISION`) are also read at module import time and emitted in the cold-start log line after both model snapshots load. Genuinely "swapping without rebuild" conflicts with offline-mode pre-baking; this tension is recorded and resolved in favour of offline-mode reliability. To swap models, change the model ID and revision env vars in the Dockerfile **and** rebuild the image — the env vars give parameterized inference code without giving up the cold-start optimization.

---

## Lambda configuration

| Setting | Value | Source |
|---|---|---|
| Memory | 2048 MB baseline; tune through 2048 / 3072 / 4096 and pick the smallest acceptable | Phase 1 |
| Timeout | 30 s | Phase 1 |
| Architecture | ARM64 | Phase 1 |
| Ephemeral storage | 512 MB (default) | models live in `/opt`, not `/tmp` |
| Reserved concurrency | 10 | Phase 2 (cost guard) |
| Env: `HF_HUB_OFFLINE` | `1` | Phase 2 |
| Env: `TRANSFORMERS_OFFLINE` | `1` | Phase 2 |
| Env: `HF_HOME` | `/opt/hf-home` | Phase 2 |
| Env: `SENTIMENT_MODEL` | `cardiffnlp/twitter-roberta-base-sentiment-latest` | Phase 1 |
| Env: `EMOTION_MODEL` | `j-hartmann/emotion-english-distilroberta-base` | Phase 1 |
| Env: `SENTIMENT_MODEL_REVISION` | Full Hugging Face commit SHA, set in Dockerfile image env | Phase 2 |
| Env: `EMOTION_MODEL_REVISION` | Full Hugging Face commit SHA, set in Dockerfile image env | Phase 2 |
| Env: `LOG_LEVEL` | `INFO` | Phase 2 |

### Memory tuning (the actual measurement, not a guess)

Lambda allocates CPU proportionally to memory; ML inference is CPU-bound, so memory increases buy real wall-clock improvements until the curve flattens. Procedure:

1. Deploy at 2048 MB with `aws lambda update-function-configuration --function-name sentiment-analyzer --memory-size 2048`, then wait with `aws lambda wait function-updated --function-name sentiment-analyzer`. Measure cold start and 20-warm p95 on a 1000-character input.
2. Deploy at 3072 MB with `aws lambda update-function-configuration --function-name sentiment-analyzer --memory-size 3072`, wait for `function-updated`, then re-measure.
3. Deploy at 4096 MB with `aws lambda update-function-configuration --function-name sentiment-analyzer --memory-size 4096`, wait for `function-updated`, then re-measure.
4. Pick the smallest size where additional memory yields <10% improvement (diminishing returns).
5. Record all three memory-size measurements in `phase2-results.md`.

This produces an interview-ready chart and avoids picking a number by gut.

---

## Function URL & CORS

- Auth type: `NONE` (public, throttled by reserved concurrency).
- Invoke mode: `BUFFERED`.
- CORS:
  - `AllowOrigins`: GitHub Pages domain (`https://<github-username>.github.io`). The exact value depends on whose account hosts the site; record once known.
  - `AllowMethods`: `POST`, `OPTIONS`.
  - `AllowHeaders`: `content-type`.
  - `MaxAge`: 300.
- During local dev (RIE), CORS is irrelevant; during early cloud testing before the frontend exists, `curl` from the terminal also doesn't need CORS.

Do not use `*` for `AllowOrigins`. Phase 1 specifies the GitHub Pages domain; Phase 5 will tighten further if needed.

`OPTIONS` is listed only in the Function URL CORS configuration so AWS can answer browser preflight requests with the expected `Access-Control-Allow-Methods` header. The handler still has no `OPTIONS` branch; if an `OPTIONS` event reaches local/RIE handler tests directly, it follows the non-`POST` contract and returns `405 METHOD_NOT_ALLOWED`.

Phase 3 local frontend development should use a Vite `server.proxy` rule to forward `/api/*` to the deployed Function URL, so the browser talks to the Vite origin and avoids CORS entirely in local dev. If the proxy gets in the way, temporarily add `http://localhost:5173` to `AllowOrigins` and remove it before the public demo, or record why both origins remain acceptable.

---

## Cold start strategy

Accept and document, not mask. The cold-start budget on the chosen models in a 3 GB container is realistically 5–15 seconds. Phase 3 will surface this in the UI as an explicit "warming up the model" state on first request rather than pretending it's normal latency.

Provisioned concurrency is rejected for v1: the cost is constant 24/7 for a portfolio demo where most hours have zero traffic. Revisit in Phase 6 only if a recruiter walks through the demo and the cold start hurts.

### Performance budget (target, to be measured)

| Metric | Target |
|---|---|
| Cold start (init + first invoke) | < 15 s |
| Warm p95 (1000-char input) | < 800 ms |
| Warm p99 | < 1500 ms |

Actual measurements go in `phase2-results.md`.

---

## Observability and logging

Use structured JSON logs at `INFO` for request-level events and `ERROR` for failures. Log enough to debug CloudWatch traces without recording user content:

- `awsRequestId` from the Lambda context.
- Function URL request id from `event["requestContext"]["requestId"]`, if present.
- HTTP method, status code, input character length, cold-start boolean, elapsed inference milliseconds, and total handler milliseconds.
- Sentiment/emotion model IDs and pinned revision SHAs at cold start.
- Error code for validation failures.

Do **not** log raw `text`, keyword terms, full request bodies, authorization headers, cookies, or client IP addresses. This project analyzes user-written content, so logs should be useful operationally without becoming a copy of user input.

---

## Local development and testing

Use AWS Lambda Runtime Interface Emulator (built into the public Lambda base image):

```
docker build --platform=linux/arm64 -t sentiment-analyzer:dev backend/
docker run --rm -p 9000:8080 sentiment-analyzer:dev
curl -s -XPOST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H 'content-type: application/json' \
  -d '{"body":"{\"text\":\"This is amazing\"}","requestContext":{"http":{"method":"POST"}}}'
```

The same Phase 1 test corpus (`backend/test_inputs.json`) is the integration fixture for the handler test.

Split tests into fast and slow tiers:

- Fast/default: `pytest -m "not slow"` with inference mocked where needed. Handler validation, response-shape, error-shape, and timestamp/input echo tests should not load transformer weights.
- Slow/manual: `pytest -m slow` for real model loading and one full RIE invocation against the built container. Include one slow test that imports the handler with real env vars and asserts the cold-start log line contains both `SENTIMENT_MODEL_REVISION` and `EMOTION_MODEL_REVISION` values.

---

## First-time infrastructure setup (Phase 1.5)

Phase 1 only validated a local Docker build. The cloud-side resources don't exist yet. Do these once, before the iterative deploy loop is meaningful. All commands assume the Phase 1 IAM user (`sentiment-dev`) is the active CLI profile.

1. **Create the ECR repository.**
   ```
   aws ecr create-repository \
     --repository-name sentiment-analyzer \
     --image-scanning-configuration scanOnPush=true \
     --region us-east-1
   ```
   Record the repository URI (`<account>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer`).

2. **Create the Lambda execution role.**
   - Trust policy: allow `lambda.amazonaws.com` to assume the role.
   - Permissions: `AWSLambdaBasicExecutionRole` (CloudWatch Logs only). The dev IAM user is not the same as the Lambda execution role; the function itself doesn't need ECR read at runtime — the Lambda service pulls the image with its own service principal.
   - Name: `sentiment-analyzer-lambda-role`.

3. **First image push** (chicken-and-egg: Lambda needs an image to point at).
   - `docker build --platform=linux/arm64 -t sentiment-analyzer:<git-sha> backend/`
   - `aws ecr get-login-password ... | docker login ...`
   - Tag and push `:<git-sha>` as the deployment source of truth. Optionally also push `:latest` as a moving convenience alias, but never use `:latest` in `create-function` or `update-function-code`.

4. **Create the Lambda function.**
   ```
   aws lambda create-function \
     --function-name sentiment-analyzer \
     --package-type Image \
     --code ImageUri=<ecr-uri>:<git-sha> \
     --architectures arm64 \
     --role arn:aws:iam::<account-id>:role/sentiment-analyzer-lambda-role \
     --memory-size 2048 \
     --timeout 30 \
     --environment "Variables={HF_HUB_OFFLINE=1,TRANSFORMERS_OFFLINE=1,HF_HOME=/opt/hf-home,SENTIMENT_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest,EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base,LOG_LEVEL=INFO}" \
     --region us-east-1
   ```

5. **Set CloudWatch Logs retention.**
   Create the log group explicitly if Lambda has not created it yet; if it already exists, skip the create command and still apply the retention policy.
   ```
   aws logs create-log-group \
     --log-group-name /aws/lambda/sentiment-analyzer \
     --region us-east-1

   aws logs put-retention-policy \
     --log-group-name /aws/lambda/sentiment-analyzer \
     --retention-in-days 14 \
     --region us-east-1
   ```

6. **Apply reserved concurrency.**
   ```
   aws lambda put-function-concurrency \
     --function-name sentiment-analyzer \
     --reserved-concurrent-executions 10
   ```

7. **Create the Function URL with CORS.**
   ```
   aws lambda create-function-url-config \
     --function-name sentiment-analyzer \
     --auth-type NONE \
     --cors '{"AllowOrigins":["https://<github-username>.github.io"],"AllowMethods":["POST","OPTIONS"],"AllowHeaders":["content-type"],"MaxAge":300}'
   ```
   Record the resulting URL — Phase 3 needs it.

8. **Smoke test the deployed contract.** Run these four checks against the Function URL:
   ```
   curl -i -X POST <function-url> \
     -H 'content-type: application/json' \
     -d '{"text":"hello"}'

   curl -i -X GET <function-url>

   curl -i -X POST <function-url> \
     -H 'content-type: application/json' \
     -d '{"text":""}'

   curl -i -X POST <function-url> \
     -H 'content-type: application/json' \
     -d "$(python3 -c 'import json; print(json.dumps({"text": "x" * 5001}))')"
   ```
   Confirm the responses are `200`, `405` with `Allow: POST`, `400 EMPTY_INPUT`, and `422 INPUT_TOO_LONG`, respectively.

These steps go into `backend/README.md` so they're replayable.

---

## Iterative manual deployment (after first-time setup)

Phase 5 automates this; Phase 2 does it by hand so the failure modes are visible.

1. `docker build --platform=linux/arm64 -t sentiment-analyzer:<git-sha> backend/`
2. Tag and push `:<git-sha>` to ECR. Optionally update `:latest` as a human-friendly alias only.
3. `aws lambda update-function-code --function-name sentiment-analyzer --image-uri <ecr-uri>:<git-sha>`
4. Wait for the update to settle (`aws lambda wait function-updated`).
5. Smoke test against the Function URL.
6. Capture cold-start + 20-warm timing.

---

## Not building in Phase 2

Held over for later phases or rejected outright:

- Authentication, per-user rate limiting (reserved concurrency is enough for v1)
- API Gateway (Function URL is sufficient)
- Provisioned concurrency (Phase 6 only if needed)
- Response caching
- Streaming responses
- Multi-region deployment
- Custom domain (Phase 6 if at all)
- Bulk/CSV endpoint (Phase 7)
- Language detection / non-English handling (no detection mechanism chosen yet)
- CI-driven deploys (Phase 5)

---

## Output

A live Lambda Function URL satisfying the Phase 1 contract plus the Phase 2 contract revisions, with cold-start and warm-path numbers across three memory sizes recorded in `phase2-results.md`. New decision-log entries: chosen dependency pins, chosen model revision SHAs, reserved concurrency rationale, and Phase 2 contract revision. Tagged `phase-2-complete` on `main`.

---

## Validation checklist

**Pre-flight (Phase 1 closeout):**
- [ ] AWS billing alert configured and SNS test email received
- [ ] Phase 1 Section H all items ticked
- [ ] `phase-1-complete` tag exists on `main`

**Phase 2 build:**
- [x] `phase2-results.md` exists with empty sections for image sizing, memory tuning matrix, and warm-path measurements
- [ ] `requirements.txt` is `pip-compile`-generated; every line has an exact version
- [ ] `requirements.in` includes a direct exact `huggingface_hub==1.x.y` pin
- [ ] Decision-log entry written for transformers / torch / yake / networkx / huggingface_hub pins
- [ ] Decision-log entry written for model revision SHAs
- [ ] Decision-log entry written for the Phase 2 contract revision (`METHOD_NOT_ALLOWED`, `INPUT_TOO_LONG` as 422, validation precedence, and service-generated 429)
- [ ] Deps-only image builds with `--platform=linux/arm64`; `import torch, transformers, yake, networkx` and `pip check` pass
- [ ] Slow smoke test loads both pinned model snapshots and runs one inference successfully under `transformers==5.x`; otherwise fall back to latest 4.x line with security advisories reviewed and recorded in decision log
- [ ] Dockerfile pre-bakes both model snapshots at pinned revisions
- [ ] Dockerfile declares `SENTIMENT_MODEL_REVISION` and `EMOTION_MODEL_REVISION`; handler reads them at module import; slow test asserts the cold-start log contains both SHA values
- [ ] `.dockerignore` excludes local/dev-only files (`.venv/`, caches, `.git/`, `explore/`, and tests/docs unless intentionally copied)
- [ ] Both env vars (`HF_HUB_OFFLINE=1` and `TRANSFORMERS_OFFLINE=1`) set; `local_files_only=True` passed at load
- [ ] Container builds locally with `--platform=linux/arm64`
- [ ] Image total size and `/opt/models/*` sizes recorded in `phase2-results.md`; image is safely under Lambda's 10 GB uncompressed limit
- [ ] RIE invocation returns a Phase 1-conformant response (emotions as object, `inputText`/`analyzedAt` present, camelCase, error shape correct)
- [ ] Handler parses Function URL payload v2.0 shape, including string `body`, `requestContext.http.method`, and `isBase64Encoded`
- [ ] Validation precedence is covered by tests: method → base64 decode → JSON parse/object check → schema/business validation
- [ ] Validation rejects empty input → 400 `EMPTY_INPUT`; >5000 chars → 422 `INPUT_TOO_LONG`; bad JSON → 400 `INVALID_JSON`; non-POST method → 405 `METHOD_NOT_ALLOWED` with `Allow: POST`
- [ ] Reserved-concurrency throttling behavior is documented as service-generated 429 outside the handler envelope
- [ ] `inputText` echo is capped at 200 characters
- [ ] `analyzedAt` is ISO 8601 UTC
- [ ] Fast pytest tier runs without loading transformer weights; slow pytest tier is marked with `@pytest.mark.slow`
- [ ] Structured logs include request ids, cold-start flag, timings, status code, and model revisions; raw input text is never logged

**Phase 2 deploy:**
- [ ] ECR repo exists; deployed image is pushed and referenced by immutable `:<git-sha>` tag (`:latest` optional, never deployment source of truth)
- [ ] Lambda execution role created; function created; CloudWatch Logs retention set to 14 days; reserved concurrency set
- [ ] Function URL CORS allows the GitHub Pages origin only (no `*`)
- [ ] CORS preflight (OPTIONS) returns expected headers
- [ ] Smoke test against Function URL returns 200 with the expected envelope
- [ ] Cold-start measured at 2048 / 3072 / 4096 MB; recorded in `phase2-results.md`
- [ ] Warm p95 measured (≥20 invocations) at the chosen memory; recorded
- [ ] `backend/README.md` documents both first-time setup and iterative deploy
- [ ] `phase-2-complete` tag applied
