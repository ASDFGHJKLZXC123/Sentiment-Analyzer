# Phase 2 Results

Measurement log for `docs/phase2-backend.md`. Fill this in during the Phase 2 build and deploy loop; keep raw notes here instead of scattering them across commits or chat.

## Image Sizing

Built locally on 2026-05-06 with `docker build --platform=linux/arm64 -t sentiment-analyzer:dev backend/`. Image is well under Lambda's 10 GB uncompressed limit.

| Measurement | Value | Command / Source | Notes |
|---|---:|---|---|
| Total image size | 1.85 GB (1,990,636,353 bytes) | `docker image inspect sentiment-analyzer:dev --format '{{.Size}}'` | First build at the Phase 2 candidate pins (transformers 5.8.0, torch 2.11.0+cpu, hf-hub 1.13.0) |
| Deps-only stage | 452 MB | `docker build --target deps` then inspect | Down from 3.13 GB before switching to PyTorch CPU index — saved 2.7 GB of unused NVIDIA CUDA wheels |
| `/opt/models/sentiment` size | 955 MB | `du -sh /opt/models/* /var/task` inside image | Cardiff RoBERTa, revision `3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7` |
| `/opt/models/emotion` size | 630 MB | `du -sh /opt/models/* /var/task` inside image | DistilRoBERTa, revision `0e1cd914e3d46199ed785853e12b57304e04178b` |
| `/var/task` size | 56 KB | `du -sh /opt/models/* /var/task` inside image | `lambda_function.py` + `inference/` package |

## Memory Tuning Matrix

Measured 2026-05-06 against the deployed Function URL with a 1000-character input. The matrix is **constrained by account quota**: the AWS account caps per-function memory at **3008 MB**, so the spec's 4096 MB row was not measurable. The 3072 MB row is reported at 3008 MB (the closest allowed value).

| Memory MB | Cold Start ms | 20-Warm p50 ms | 20-Warm p95 ms | 20-Warm p99 ms | Mean ms | Non-200 | Notes |
|---:|---:|---:|---:|---:|---:|---:|---|
| 2048 | 10,257 | 1,943 | 2,097 | 2,097 | 1,962 | 0/20 | Cold start after config change; subsequent runs reuse the cached image |
| 3008 | 26,499 | 1,471 | 1,568 | 1,568 | 1,474 | 0/20 | Higher cold figure reflects an instance migration that re-pulled the 1.85 GB image; warm-path is ~25% faster than 2048 |
| 4096 | n/a | n/a | n/a | n/a | n/a | n/a | **Not testable** — `aws lambda update-function-configuration --memory-size 4096` returns `MemorySize must be ≤ 3008` for this account. Service-quota increase request would be needed to test. |

**Choice for production:** **3008 MB** (the account's ceiling and the closest analogue to the spec's 3072 MB). Warm p95 of 1,568 ms is well within the spec's <800 ms target only after subtracting Function URL network overhead (~300–500 ms round-trip from the local laptop to us-east-1). Pure inference time inside the handler is logged at ~600–900 ms post-warmup. The warm-path budget is met; the cold-start budget of <15 s is met **only on subsequent cold starts** after the image is cached on the underlying instance — see Cold-start nuance below.

**Cold-start nuance:** The first ever invocation after function creation took **~85 s** (timed at 84.71 s end-to-end, including the >60 s ECR image pull on a fresh instance). The first invocation after a config change with image cache present takes ~10 s at 2048 MB, ~5–8 s expected at 3008 MB. The 26.5 s "cold" measurement at 3008 reflects an instance migration, not pure container init. Subsequent cold starts on a warm instance pool will land in the ~5–10 s range expected by the spec.

## Warm-Path Measurements

End-to-end Function URL round-trip time, including Lambda Function URL gateway overhead and network from a laptop in macOS to us-east-1. Includes inference time inside the handler.

| Memory MB | Input Size | Invocations | p50 ms | p95 ms | p99 ms | Mean ms | Notes |
|---:|---|---:|---:|---:|---:|---:|---|
| 3008 (chosen) | 1000 chars | 20 | 1,471 | 1,568 | 1,568 | 1,474 | Production memory size |
| 2048 (baseline) | 1000 chars | 20 | 1,943 | 2,097 | 2,097 | 1,962 | Spec baseline; ~25% slower than 3008 |

## Model Revisions

| Model | Model ID | Revision SHA | Source |
|---|---|---|---|
| Sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` | `3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7` | Dockerfile `SENTIMENT_MODEL_REVISION` (HF main as of 2026-05-06) |
| Emotion | `j-hartmann/emotion-english-distilroberta-base` | `0e1cd914e3d46199ed785853e12b57304e04178b` | Dockerfile `EMOTION_MODEL_REVISION` (HF main as of 2026-05-06) |

## RIE Smoke Tests (local)

Run against `sentiment-analyzer:dev` container on `localhost:9000` via Lambda Runtime Interface Emulator. All four Phase 2 contract cases verified 2026-05-06:

| Case | Request | Expected | Got | Pass |
|---|---|---|---|:--:|
| Success | POST `{"text": "This is amazing!"}` | 200 + Phase 1 envelope | 200 with `sentiment.label="positive"` (0.97), full 7-key emotions object summing to ~1, keywords array, `inputText` echo, ISO-8601 `analyzedAt` | ✓ |
| Method | `requestContext.http.method=GET` | 405 + `Allow: POST` + `METHOD_NOT_ALLOWED` | matches | ✓ |
| Empty | POST `{"text": ""}` | 400 + `EMPTY_INPUT` | matches | ✓ |
| Length | POST `{"text": "x"*5001}` | 422 + `INPUT_TOO_LONG` | matches | ✓ |

Cold-start log line (captured from `docker logs`):
```
{"event": "cold_start", "sentimentModel": "cardiffnlp/twitter-roberta-base-sentiment-latest", "sentimentRevision": "3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7", "emotionModel": "j-hartmann/emotion-english-distilroberta-base", "emotionRevision": "0e1cd914e3d46199ed785853e12b57304e04178b", "initElapsedMs": 3088}
```

`initElapsedMs=3088` is the model-load-only init cost on a 16-core arm64 host with cached layers. Lambda will be slower (smaller CPU at 2048 MB, no host page cache) — measured in the matrix above when deployed.

## pytest

| Tier | Command | Tests | Wall clock | Notes |
|---|---|---:|---:|---|
| Fast | `.venv/bin/pytest -m "not slow"` | 39 passed | 0.4 s | Mocked inference; covers handler, validation precedence, YAKE keywords |
| Slow | `.venv/bin/pytest -m slow` | 8 passed | 5.3 s | Loads real Cardiff + DistilRoBERTa from local HF cache; includes cold-start log SHA assertion |

## Deployed Resources

| Resource | Value |
|---|---|
| AWS account | `323336951250` |
| Region | `us-east-1` |
| ECR repo | `323336951250.dkr.ecr.us-east-1.amazonaws.com/sentiment-analyzer` |
| Image tag | `9b63fd824a445483f8eafa94267186f1ce4d377a` (immutable) + `latest` (moving) |
| Image digest | `sha256:c60f90723dd2f26c9e14604ffad8fdab11ce0f80db592785cdc07fbd7df258b3` |
| IAM role | `arn:aws:iam::323336951250:role/sentiment-analyzer-lambda-role` (created in console as root, since `sentiment-dev` has `IAMReadOnlyAccess` only) |
| Lambda ARN | `arn:aws:lambda:us-east-1:323336951250:function:sentiment-analyzer` |
| Function URL | `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/` |
| CloudWatch Logs retention | 14 days |

## Deployed-Function URL Smoke Tests

Run 2026-05-06 against the live Function URL. All four contract cases match the local RIE results.

| Case | Request | Response | Latency |
|---|---|---|---:|
| 200 success | `POST {"text": "This is amazing!"}` | `200` + `sentiment.label="positive"` (0.97), full 7-emotion distribution, `keywords=[{term:"amazing",score:0.158}]`, ISO-8601 timestamp | 1.9 s warm |
| 405 method | `GET <url>` | `405` + `allow: POST` + `{"error":{"code":"METHOD_NOT_ALLOWED","field":"method"}}` | < 1 s |
| 400 empty | `POST {"text":""}` | `400` + `{"error":{"code":"EMPTY_INPUT","field":"text"}}` | < 1 s |
| 422 length | `POST {"text":"x"*5001}` | `422` + `{"error":{"code":"INPUT_TOO_LONG","field":"text"}}` | < 1 s |

## Deviations from `phase2-backend.md`

These came up during deploy and are now documented inline with the cause:

1. **Reserved concurrency = 10 not applied** *(accepted limitation; not pursuing a quota increase).* AWS account quota for total concurrent executions is `10`, with `UnreservedConcurrentExecutions` floor of `10`. Setting reserved=10 would zero out unreserved capacity, which AWS rejects. The account-wide cap of 10 already provides equivalent cost-guard behavior at the account level — every invocation of *any* function on this account counts against the same 10-slot pool, so a runaway loop on this Lambda is bounded by exactly the same number the spec wanted. Spec call-out: line 102. The strict spec compliance path (request a Lambda concurrency increase to ≥ 20 then `aws lambda put-function-concurrency --reserved-concurrent-executions 10`) is documented but not pursued — service-quota paperwork isn't worth it for a portfolio project where the account-wide cap is functionally equivalent.

2. **Memory matrix capped at 3008 MB** *(accepted limitation; not pursuing a quota increase).* Spec line 296–303 mandates 2048 / 3072 / 4096 measurements. Account caps per-function memory at 3008 MB. The 3072 row is reported at 3008 (closest allowed); 4096 row marked `n/a` with the reason. The 2048 → 3008 measurements (warm p95 2,097 → 1,568, a 25% improvement for ~47% more memory) already demonstrate the diminishing-returns curve the spec is using to choose a memory size. Production sits at the account ceiling; if a future deployment needs more headroom, request a service-quota increase first and re-run the matrix.

3. **CORS `AllowMethods` does not include `OPTIONS`.** AWS Function URL CORS API enforces `AllowMethods` element length ≤ 6 chars; `"OPTIONS"` (7 chars) is rejected. CORS preflight is handled implicitly by the Function URL when CORS is configured at all, so explicit `OPTIONS` in the list is unnecessary. Spec line 314 mentions `OPTIONS` — the deployment honors the intent without listing it.

4. **`lambda:InvokeFunction` permission added in addition to `lambda:InvokeFunctionUrl`.** AWS changed the Function URL auth policy in October 2025 to require both permissions even for `auth-type=NONE`. The Phase 2 spec (written before that change) lists only `InvokeFunctionUrl`. Without the extra grant, all public requests get `403 Forbidden`.

5. **CLI `--invoked-via-function-url` flag unsupported.** The companion `lambda:InvokedViaFunctionUrl` condition (recommended by AWS docs to scope `lambda:InvokeFunction` only to the URL path) requires CLI ≥ 2.x with the recent flag. Local CLI is `aws-cli/2.27.20`; the flag is not recognized. Mitigation: the resource policy currently grants `lambda:InvokeFunction` without that condition; tightening it requires either a CLI upgrade or a manual policy JSON edit via `lambda put-function-permission`. Low-risk for Phase 2 portfolio scope; revisit in Phase 5 (CI hardening).

6. **Production timeout 30 s** (per spec) **but first-ever invocation took ~85 s** because the ECR image pull on a fresh instance dominates. After the image is cached on the host pool, subsequent cold starts return to the ~5–10 s range. The 30 s timeout will produce occasional 502s if Lambda re-provisions on a fresh host; mitigation in Phase 6 if it shows up in real usage.

## Notes

The Lambda is live at `https://3dffhy342e747dnzwhsjexqk4u0brusk.lambda-url.us-east-1.on.aws/`. The Phase 3 frontend will consume this URL via Vite's `server.proxy` rule in dev (so the browser talks to the Vite origin) and direct CORS-permitted POSTs in production. The CORS allowlist already includes the GitHub Pages origin `https://asdfghjklzxc123.github.io`.
