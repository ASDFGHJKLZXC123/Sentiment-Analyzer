# Phase 2 Results

Measurement log for `docs/phase2-backend.md`. Fill this in during the Phase 2 build and deploy loop; keep raw notes here instead of scattering them across commits or chat.

## Image Sizing

| Measurement | Value | Command / Source | Notes |
|---|---:|---|---|
| Total image size | TBD | `docker image inspect sentiment-analyzer:<git-sha> --format '{{.Size}}'` |  |
| `/opt/models/sentiment` size | TBD | `du -sh /opt/models/* /var/task` inside image |  |
| `/opt/models/emotion` size | TBD | `du -sh /opt/models/* /var/task` inside image |  |
| `/var/task` size | TBD | `du -sh /opt/models/* /var/task` inside image |  |

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
| Sentiment | `cardiffnlp/twitter-roberta-base-sentiment-latest` | TBD | Dockerfile `SENTIMENT_MODEL_REVISION` |
| Emotion | `j-hartmann/emotion-english-distilroberta-base` | TBD | Dockerfile `EMOTION_MODEL_REVISION` |

## Notes

TBD.
