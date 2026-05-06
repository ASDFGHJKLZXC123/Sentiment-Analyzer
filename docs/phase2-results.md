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

Use a 1000-character input for each row. After every memory change, run `aws lambda wait function-updated --function-name sentiment-analyzer` before measuring.

| Memory MB | Cold Start ms | First Invoke Total ms | 20-Warm p95 ms | 20-Warm p99 ms | Notes |
|---:|---:|---:|---:|---:|---|
| 2048 | TBD | TBD | TBD | TBD |  |
| 3072 | TBD | TBD | TBD | TBD |  |
| 4096 | TBD | TBD | TBD | TBD |  |

## Warm-Path Measurements

| Memory MB | Input Size | Invocations | p50 ms | p95 ms | p99 ms | Notes |
|---:|---|---:|---:|---:|---:|---|
| TBD | 1000 chars | 20+ | TBD | TBD | TBD |  |

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

## Notes

TBD until Lambda deploy + memory matrix.
