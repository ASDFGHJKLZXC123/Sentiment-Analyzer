"""Sentiment classification — Cardiff Twitter RoBERTa.

Weights are pre-baked at /opt/models/sentiment by the Dockerfile's
snapshot_download step, pinned to SENTIMENT_MODEL_REVISION. Combined
with HF_HUB_OFFLINE=1 and TRANSFORMERS_OFFLINE=1 in the runtime env,
loading is fully offline and no network calls happen at module init.
"""

import os

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

# MODEL_PATH defaults to the production snapshot path; tests override
# via env to point at the local Hugging Face cache.
MODEL_PATH = os.environ.get("SENTIMENT_MODEL_PATH", "/opt/models/sentiment")
MODEL_ID = os.environ["SENTIMENT_MODEL"]
MODEL_REVISION = os.environ["SENTIMENT_MODEL_REVISION"]

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)
model.eval()
ID2LABEL = model.config.id2label


def analyze(text: str) -> dict:
    """Return {"label": "positive|negative|neutral", "confidence": float}."""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = model(**inputs).logits
    probs = torch.softmax(logits, dim=-1)[0]
    top_idx = int(torch.argmax(probs))
    return {
        "label": ID2LABEL[top_idx],
        "confidence": round(float(probs[top_idx]), 6),
    }
