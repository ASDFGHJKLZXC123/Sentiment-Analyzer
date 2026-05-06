"""Sentiment classification tests.

Marked slow because they load the real Cardiff RoBERTa weights from the
Phase 1 HF cache. Setting *_MODEL_PATH to the model ID lets transformers
resolve via the local cache instead of the production /opt/models path.
"""

import os
import sys

import pytest


@pytest.fixture
def real_sentiment(monkeypatch):
    monkeypatch.setenv("SENTIMENT_MODEL_PATH", os.environ["SENTIMENT_MODEL"])
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)
    monkeypatch.delitem(sys.modules, "inference.sentiment", raising=False)
    monkeypatch.delitem(sys.modules, "inference", raising=False)
    return __import__("inference.sentiment", fromlist=["analyze", "MODEL_ID", "MODEL_REVISION"])


@pytest.mark.slow
def test_analyze_returns_label_and_confidence(real_sentiment):
    result = real_sentiment.analyze("This is the best purchase I've ever made.")
    assert set(result) == {"label", "confidence"}
    assert result["label"] in {"positive", "negative", "neutral"}
    assert 0.0 <= result["confidence"] <= 1.0


@pytest.mark.slow
def test_clear_positive_predicted_positive(real_sentiment):
    result = real_sentiment.analyze("Amazing experience! Highly recommend.")
    assert result["label"] == "positive"


@pytest.mark.slow
def test_clear_negative_predicted_negative(real_sentiment):
    result = real_sentiment.analyze(
        "Terrible product. It broke after one day and customer service ignored me."
    )
    assert result["label"] == "negative"


@pytest.mark.slow
def test_module_exports_pinned_revision(real_sentiment):
    """MODEL_REVISION carries the env-pinned SHA used in cold-start logs."""
    assert real_sentiment.MODEL_REVISION == os.environ["SENTIMENT_MODEL_REVISION"]
    assert real_sentiment.MODEL_ID == os.environ["SENTIMENT_MODEL"]
