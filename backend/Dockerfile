# syntax=docker/dockerfile:1.7

# Stage 1: deps — fast gate before slow model downloads.
# Build with `--target deps` to validate Python 3.13 / Linux ARM64
# wheels and pip-resolver health before pulling multi-GB snapshots.
FROM public.ecr.aws/lambda/python:3.13 AS deps

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt


# Stage 2: models — pre-bake model weights at pinned commit SHAs.
# The ENV revisions are the single source of truth: snapshot_download
# reads them at build time, and the runtime inference modules read the
# same vars at module import for cold-start log emission.
FROM deps AS models

ENV SENTIMENT_MODEL=cardiffnlp/twitter-roberta-base-sentiment-latest \
    EMOTION_MODEL=j-hartmann/emotion-english-distilroberta-base \
    SENTIMENT_MODEL_REVISION=3216a57f2a0d9c45a2e6c20157c20c49fb4bf9c7 \
    EMOTION_MODEL_REVISION=0e1cd914e3d46199ed785853e12b57304e04178b

RUN python -c "import os; from huggingface_hub import snapshot_download; \
snapshot_download(repo_id=os.environ['SENTIMENT_MODEL'], revision=os.environ['SENTIMENT_MODEL_REVISION'], local_dir='/opt/models/sentiment'); \
snapshot_download(repo_id=os.environ['EMOTION_MODEL'], revision=os.environ['EMOTION_MODEL_REVISION'], local_dir='/opt/models/emotion')"


# Stage 3: runtime — application code + offline-mode env.
# HF_HUB_OFFLINE=1 + TRANSFORMERS_OFFLINE=1 plus local_files_only=True
# at the load call site eliminates the per-cold-start freshness check.
FROM models AS runtime

ENV HF_HUB_OFFLINE=1 \
    TRANSFORMERS_OFFLINE=1 \
    HF_HOME=/opt/hf-home \
    LOG_LEVEL=INFO

COPY lambda_function.py ${LAMBDA_TASK_ROOT}/
COPY inference ${LAMBDA_TASK_ROOT}/inference

CMD ["lambda_function.handler"]
