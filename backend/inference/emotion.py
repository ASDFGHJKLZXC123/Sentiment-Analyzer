"""Emotion classification — j-hartmann DistilRoBERTa.

Returns the full distribution across 7 emotions: anger, disgust, fear,
joy, neutral, sadness, surprise. The frontend renders a bar chart over
the full distribution rather than just the top label.
"""

import os

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_PATH = os.environ.get("EMOTION_MODEL_PATH", "/opt/models/emotion")
MODEL_ID = os.environ["EMOTION_MODEL"]
MODEL_REVISION = os.environ["EMOTION_MODEL_REVISION"]

tokenizer = AutoTokenizer.from_pretrained(MODEL_PATH, local_files_only=True)
model = AutoModelForSequenceClassification.from_pretrained(MODEL_PATH, local_files_only=True)
model.eval()
ID2LABEL = model.config.id2label


def analyze(text: str) -> dict:
    """Return {label: probability, ...} across all 7 emotions."""
    inputs = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
    with torch.no_grad():
        logits = model(**inputs).logits
    probs = torch.softmax(logits, dim=-1)[0]
    return {ID2LABEL[i]: round(float(probs[i]), 6) for i in range(len(probs))}
