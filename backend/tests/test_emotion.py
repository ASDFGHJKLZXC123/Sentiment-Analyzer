"""Emotion classification tests.

Marked slow because they load the real DistilRoBERTa weights from the
Phase 1 HF cache.
"""

import os
import sys

import pytest

EXPECTED_EMOTIONS = {"anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise"}


@pytest.fixture
def real_emotion(monkeypatch):
    monkeypatch.setenv("EMOTION_MODEL_PATH", os.environ["EMOTION_MODEL"])
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)
    monkeypatch.delitem(sys.modules, "inference.emotion", raising=False)
    monkeypatch.delitem(sys.modules, "inference", raising=False)
    return __import__("inference.emotion", fromlist=["analyze", "MODEL_ID", "MODEL_REVISION"])


@pytest.mark.slow
def test_analyze_returns_full_distribution(real_emotion):
    result = real_emotion.analyze("I'm so happy today!")
    assert set(result) == EXPECTED_EMOTIONS
    for label, prob in result.items():
        assert 0.0 <= prob <= 1.0, f"{label}={prob}"
    total = sum(result.values())
    assert abs(total - 1.0) < 1e-3, f"probabilities should sum to ~1, got {total}"


@pytest.mark.slow
def test_joy_dominates_for_positive_input(real_emotion):
    result = real_emotion.analyze(
        "I'm absolutely thrilled and overjoyed by this wonderful surprise!"
    )
    top = max(result, key=result.get)
    assert top in {"joy", "surprise"}


@pytest.mark.slow
def test_module_exports_pinned_revision(real_emotion):
    assert real_emotion.MODEL_REVISION == os.environ["EMOTION_MODEL_REVISION"]
    assert real_emotion.MODEL_ID == os.environ["EMOTION_MODEL"]
