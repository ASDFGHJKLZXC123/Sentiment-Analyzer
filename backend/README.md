# Backend — Sentiment Analyzer Lambda

Python 3.13 inference Lambda that satisfies the Phase 1 API contract: sentiment + emotion + YAKE keywords. Deployed as a container image to ECR, fronted by a Lambda Function URL.

For the full design rationale, see `docs/phase2-backend.md`. This README is the reproduction manual.

## Repository layout

```
backend/
├── Dockerfile                 # multi-stage: deps -> models -> runtime
├── .dockerignore
├── requirements.in            # direct pins (transformers, torch, yake, hf-hub)
├── requirements.txt           # pip-compile-generated lockfile
├── requirements-dev.txt       # local dev-venv: pytest + pip-tools
├── pyproject.toml             # pytest config + slow marker
├── lambda_function.py         # handler entry — Function URL v2.0
├── inference/
│   ├── __init__.py
│   ├── sentiment.py           # cardiffnlp/twitter-roberta-base-sentiment-latest
│   ├── emotion.py             # j-hartmann/emotion-english-distilroberta-base
│   └── keywords.py            # YAKE wrapper
├── tests/
│   ├── __init__.py
│   ├── conftest.py            # fixtures + mock inference
│   ├── test_handler.py        # handler success + cold-start log
│   ├── test_validation.py     # validation precedence
│   ├── test_sentiment.py      # @slow — real Cardiff model
│   ├── test_emotion.py        # @slow — real DistilRoBERTa model
│   └── test_keywords.py       # real YAKE (no model load)
├── explore/                   # Phase 1 model-evaluation scratch (not deployed)
└── test_inputs.json           # 24-case test corpus from Phase 1
```

## Local dev environment

Python 3.13 is required (matches Lambda's `public.ecr.aws/lambda/python:3.13` runtime). The local venv lives at `backend/.venv`.

```bash
cd backend
python3.13 -m venv .venv
.venv/bin/pip install -r requirements-dev.txt
```

The first install pulls torch (~600 MB), transformers (~100 MB), and tokenizers. After that, repeat installs are fast.

## Running tests

```bash
cd backend
.venv/bin/pytest -m "not slow"   # fast tier — 39 tests, ~0.5 s
.venv/bin/pytest -m slow         # slow tier — loads real models, ~5 s warm
.venv/bin/pytest                 # everything
```

Fast tier mocks the inference modules and covers the entire HTTP contract: validation precedence, error envelope shapes, status-code mapping, response shape, base64 decoding, and the cold-start log line.

Slow tier loads the real Cardiff RoBERTa and j-hartmann DistilRoBERTa models from the local Hugging Face cache. Phase 1 already populated the cache via `backend/explore/evaluate_corpus.py`; if your cache is fresh, the first slow run downloads ~1.5 GB.

## Updating dependency pins

Edit `requirements.in`, then regenerate the lockfile:

```bash
cd backend
.venv/bin/pip-compile --resolver=backtracking --output-file=requirements.txt requirements.in
```

The `--extra-index-url https://download.pytorch.org/whl/cpu` directive in `requirements.in` is critical — it pulls the `torch==2.11.0+cpu` wheel and saves ~2.7 GB of unused NVIDIA CUDA bundles in the Lambda image.

## Building the container locally

```bash
# Fast gate: deps stage only (~30 s)
docker build --platform=linux/arm64 --target deps -t sentiment-analyzer:deps backend/
docker run --rm sentiment-analyzer:deps python -c "import torch, transformers, yake, networkx"
docker run --rm sentiment-analyzer:deps pip check

# Full image with model snapshots (~1 min on cached layers, ~3-5 min cold)
docker build --platform=linux/arm64 -t sentiment-analyzer:dev backend/

# Verify size + per-model breakdown
docker image inspect sentiment-analyzer:dev --format '{{.Size}}'
docker run --rm --entrypoint /bin/sh sentiment-analyzer:dev -c 'du -sh /opt/models/* /var/task'
```

To swap models, change `SENTIMENT_MODEL`, `SENTIMENT_MODEL_REVISION`, `EMOTION_MODEL`, and/or `EMOTION_MODEL_REVISION` in the `Dockerfile` `ENV` block, then rebuild. The image holds the model identity; runtime config never overrides it.

## Local invocation via RIE

```bash
docker run -d --rm --name sentiment-rie -p 9000:8080 sentiment-analyzer:dev

# Wait ~5 s for module init, then smoke-test:
curl -s -X POST "http://localhost:9000/2015-03-31/functions/function/invocations" \
  -H 'content-type: application/json' \
  -d '{"requestContext":{"http":{"method":"POST"},"requestId":"x"},"isBase64Encoded":false,"body":"{\"text\":\"This is amazing!\"}"}' \
  | python3 -m json.tool

docker stop sentiment-rie
```

The four contract cases (200 success, 405 non-POST, 400 EMPTY_INPUT, 422 INPUT_TOO_LONG) are reproducible via `curl` against the same endpoint.

## First-time AWS infrastructure setup

All commands assume the Phase 1 `sentiment-dev` IAM profile is the active CLI profile (`aws sts get-caller-identity` should return that user). Region `us-east-1`.

### 1. Create the ECR repository

```bash
aws ecr create-repository \
  --repository-name sentiment-analyzer \
  --image-scanning-configuration scanOnPush=true \
  --region us-east-1
```

Record the resulting URI: `<account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer`.

### 2. Create the Lambda execution role

```bash
cat > /tmp/lambda-trust.json <<'EOF'
{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"lambda.amazonaws.com"},"Action":"sts:AssumeRole"}]}
EOF

aws iam create-role \
  --role-name sentiment-analyzer-lambda-role \
  --assume-role-policy-document file:///tmp/lambda-trust.json

aws iam attach-role-policy \
  --role-name sentiment-analyzer-lambda-role \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
```

The role only needs CloudWatch Logs write permissions. Lambda's service principal pulls the image from ECR, so the role does not need ECR read.

### 3. Push the first image

```bash
SHA=$(git rev-parse HEAD)
aws ecr get-login-password --region us-east-1 \
  | docker login --username AWS --password-stdin <account-id>.dkr.ecr.us-east-1.amazonaws.com
docker tag sentiment-analyzer:dev <account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:$SHA
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:$SHA
```

The immutable `:$SHA` tag is the deployment source of truth. `:latest` is optional and never used in `create-function` / `update-function-code`.

### 4. Create the Lambda function

```bash
aws lambda create-function \
  --function-name sentiment-analyzer \
  --package-type Image \
  --code ImageUri=<account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:$SHA \
  --architectures arm64 \
  --role arn:aws:iam::<account-id>:role/sentiment-analyzer-lambda-role \
  --memory-size 2048 \
  --timeout 30 \
  --environment "Variables={HF_HUB_OFFLINE=1,TRANSFORMERS_OFFLINE=1,HF_HOME=/opt/hf-home,SENTIMENT_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest,EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base,LOG_LEVEL=INFO}" \
  --region us-east-1
```

`SENTIMENT_MODEL_REVISION` and `EMOTION_MODEL_REVISION` are baked into the image via Dockerfile `ENV`; do not duplicate them in the Lambda configuration.

### 5. CloudWatch Logs retention

```bash
aws logs create-log-group --log-group-name /aws/lambda/sentiment-analyzer --region us-east-1 || true
aws logs put-retention-policy \
  --log-group-name /aws/lambda/sentiment-analyzer \
  --retention-in-days 14 \
  --region us-east-1
```

### 6. Reserved concurrency

```bash
aws lambda put-function-concurrency \
  --function-name sentiment-analyzer \
  --reserved-concurrent-executions 10 \
  --region us-east-1
```

This is the cost guardrail — Function URL has no built-in throttling.

### 7. Function URL with CORS

```bash
aws lambda create-function-url-config \
  --function-name sentiment-analyzer \
  --auth-type NONE \
  --invoke-mode BUFFERED \
  --cors '{"AllowOrigins":["https://asdfghjklzxc123.github.io"],"AllowMethods":["POST","OPTIONS"],"AllowHeaders":["content-type"],"MaxAge":300}' \
  --region us-east-1
```

Record the resulting `FunctionUrl` — Phase 3 needs it.

### 8. Smoke-test the deployed contract

```bash
URL=$(aws lambda get-function-url-config --function-name sentiment-analyzer --region us-east-1 --query FunctionUrl --output text)

curl -i -X POST "$URL" -H 'content-type: application/json' -d '{"text":"hello"}'
curl -i -X GET "$URL"
curl -i -X POST "$URL" -H 'content-type: application/json' -d '{"text":""}'
curl -i -X POST "$URL" -H 'content-type: application/json' \
  -d "$(python3 -c 'import json; print(json.dumps({"text": "x" * 5001}))')"
```

Expected statuses: `200`, `405` with `Allow: POST`, `400 EMPTY_INPUT`, `422 INPUT_TOO_LONG`.

## Iterative manual deployment

```bash
SHA=$(git rev-parse HEAD)

docker build --platform=linux/arm64 -t sentiment-analyzer:dev backend/
docker tag sentiment-analyzer:dev <account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:$SHA
docker push <account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:$SHA

aws lambda update-function-code \
  --function-name sentiment-analyzer \
  --image-uri <account-id>.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer:$SHA \
  --region us-east-1

aws lambda wait function-updated --function-name sentiment-analyzer --region us-east-1

# Re-run the smoke tests from step 8.
```

Phase 5 will replace this with a GitHub Actions OIDC pipeline.

## Memory tuning

Lambda allocates CPU proportional to memory; ML inference is CPU-bound. The Phase 2 spec mandates measuring at 2048 / 3072 / 4096 MB and picking the smallest size where additional memory yields <10 % p95 improvement. Procedure and matrix go in `docs/phase2-results.md`.

```bash
for SIZE in 2048 3072 4096; do
  aws lambda update-function-configuration \
    --function-name sentiment-analyzer \
    --memory-size $SIZE \
    --region us-east-1
  aws lambda wait function-updated --function-name sentiment-analyzer --region us-east-1
  # Capture cold start + 20 warm invocations against URL, record in phase2-results.md.
done
```

## Troubleshooting

- **`AccessDenied` on `aws lambda` commands** — verify `aws sts get-caller-identity` returns `arn:aws:iam::<account-id>:user/sentiment-dev`. If wrong profile is active, `export AWS_PROFILE=sentiment-dev`.
- **Build fails with `no matching manifest for linux/arm64`** — your local Docker may not have `buildx` ARM64 emulation enabled. On Apple Silicon hosts this is automatic.
- **`pip check` reports a conflict** — re-run `pip-compile` from a clean dev venv. The lockfile in `requirements.txt` should always pass `pip check`.
- **Cold start log line missing in CloudWatch** — confirm `LOG_LEVEL` env var is `INFO`. The line emits at module import, before the first invocation, so it appears once per warm window.
- **Lambda 429 with the JSON error envelope** — that's not from the handler. Reserved concurrency throttling is service-generated and AWS-owned. Increase reserved concurrency or the client should map 429 to a "throttled" UI state.
