"""Handler success-path tests with mocked inference."""

import base64
import json
import os
import re
import sys
from unittest.mock import MagicMock

import pytest

from tests.conftest import TEST_EMOTION_SHA, TEST_SENTIMENT_SHA, _build_mock_inference, make_event

ISO_8601_UTC = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$")


def test_post_returns_phase1_envelope(handler_module, lambda_context):
    event = make_event(body={"text": "This is amazing"})
    response = handler_module.handler(event, lambda_context)

    assert response["statusCode"] == 200
    assert response["headers"]["Content-Type"] == "application/json"
    assert response["isBase64Encoded"] is False

    body = json.loads(response["body"])
    assert body["sentiment"] == {"label": "positive", "confidence": 0.873}
    assert set(body["emotions"]) == {
        "anger", "disgust", "fear", "joy", "neutral", "sadness", "surprise",
    }
    assert isinstance(body["keywords"], list)
    assert all({"term", "score"} == set(k) for k in body["keywords"])
    assert body["inputText"] == "This is amazing"
    assert ISO_8601_UTC.match(body["analyzedAt"])


def test_input_text_capped_at_200_chars(handler_module, lambda_context):
    long_text = "x" * 1500
    event = make_event(body={"text": long_text})
    response = handler_module.handler(event, lambda_context)
    body = json.loads(response["body"])
    assert len(body["inputText"]) == 200


def test_handler_invokes_all_three_inference_modules(handler_module, lambda_context):
    sentiment_mock, emotion_mock, keywords_mock = handler_module._mocks
    event = make_event(body={"text": "hello"})
    handler_module.handler(event, lambda_context)
    sentiment_mock.analyze.assert_called_once_with("hello")
    emotion_mock.analyze.assert_called_once_with("hello")
    keywords_mock.analyze.assert_called_once_with("hello")


def test_base64_encoded_body_is_decoded(handler_module, lambda_context):
    encoded = base64.b64encode(json.dumps({"text": "encoded hi"}).encode()).decode()
    event = make_event(raw_body=encoded, base64=True)
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 200
    body = json.loads(response["body"])
    assert body["inputText"] == "encoded hi"


def test_cold_start_log_contains_both_revision_shas(monkeypatch, caplog):
    """Cold-start log line emits both revision SHAs at module init.

    Uses mocked inference so it runs in the fast tier; the SHAs come
    from env vars, not model weights, so this is the right level for
    catching log-shape regressions.
    """
    fake_sentiment, fake_emotion, fake_keywords = _build_mock_inference()
    fake_pkg = MagicMock(sentiment=fake_sentiment, emotion=fake_emotion, keywords=fake_keywords)
    monkeypatch.setitem(sys.modules, "inference", fake_pkg)
    monkeypatch.setitem(sys.modules, "inference.sentiment", fake_sentiment)
    monkeypatch.setitem(sys.modules, "inference.emotion", fake_emotion)
    monkeypatch.setitem(sys.modules, "inference.keywords", fake_keywords)
    monkeypatch.delitem(sys.modules, "lambda_function", raising=False)

    with caplog.at_level("INFO"):
        import lambda_function  # noqa: F401, PLC0415

    log_text = " ".join(r.getMessage() for r in caplog.records)
    assert TEST_SENTIMENT_SHA in log_text
    assert TEST_EMOTION_SHA in log_text
    assert "cold_start" in log_text


@pytest.mark.slow
def test_cold_start_log_with_real_models(monkeypatch, caplog):
    """Slow tier: load real models from the local HF cache and confirm
    the cold-start log line still emits both revision SHAs.

    Phase 1 already cached both models in `~/.cache/huggingface/hub/`.
    Setting `*_MODEL_PATH` to the model ID lets transformers resolve
    from cache via id+local_files_only.
    """
    monkeypatch.setenv("SENTIMENT_MODEL_PATH", os.environ["SENTIMENT_MODEL"])
    monkeypatch.setenv("EMOTION_MODEL_PATH", os.environ["EMOTION_MODEL"])
    monkeypatch.delenv("HF_HUB_OFFLINE", raising=False)
    monkeypatch.delenv("TRANSFORMERS_OFFLINE", raising=False)

    for mod in ("inference", "inference.sentiment", "inference.emotion",
                "inference.keywords", "lambda_function"):
        monkeypatch.delitem(sys.modules, mod, raising=False)

    with caplog.at_level("INFO"):
        import lambda_function  # noqa: F401, PLC0415

    log_text = " ".join(r.getMessage() for r in caplog.records)
    assert TEST_SENTIMENT_SHA in log_text
    assert TEST_EMOTION_SHA in log_text
