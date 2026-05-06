"""Shared pytest fixtures and environment setup.

Env vars are set at module load (before any test imports lambda_function
or inference.*) because those modules read them at import time.
"""

import json
import os
import sys
from unittest.mock import MagicMock

import pytest

# 40-char placeholder SHAs — real values come from Dockerfile ENV in
# production. Tests assert these strings appear in the cold-start log.
TEST_SENTIMENT_SHA = "a" * 40
TEST_EMOTION_SHA = "b" * 40

os.environ.setdefault("SENTIMENT_MODEL", "cardiffnlp/twitter-roberta-base-sentiment-latest")
os.environ.setdefault("SENTIMENT_MODEL_REVISION", TEST_SENTIMENT_SHA)
os.environ.setdefault("EMOTION_MODEL", "j-hartmann/emotion-english-distilroberta-base")
os.environ.setdefault("EMOTION_MODEL_REVISION", TEST_EMOTION_SHA)
os.environ.setdefault("LOG_LEVEL", "INFO")


def _build_mock_inference():
    fake_sentiment = MagicMock()
    fake_sentiment.MODEL_ID = os.environ["SENTIMENT_MODEL"]
    fake_sentiment.MODEL_REVISION = os.environ["SENTIMENT_MODEL_REVISION"]
    fake_sentiment.analyze = MagicMock(
        return_value={"label": "positive", "confidence": 0.873}
    )

    fake_emotion = MagicMock()
    fake_emotion.MODEL_ID = os.environ["EMOTION_MODEL"]
    fake_emotion.MODEL_REVISION = os.environ["EMOTION_MODEL_REVISION"]
    fake_emotion.analyze = MagicMock(
        return_value={
            "anger": 0.02,
            "disgust": 0.01,
            "fear": 0.03,
            "joy": 0.78,
            "neutral": 0.10,
            "sadness": 0.04,
            "surprise": 0.02,
        }
    )

    fake_keywords = MagicMock()
    fake_keywords.analyze = MagicMock(
        return_value=[{"term": "Amazing experience", "score": 0.042}]
    )

    return fake_sentiment, fake_emotion, fake_keywords


@pytest.fixture
def handler_module(monkeypatch):
    """Import lambda_function with mocked inference modules.

    The fixture is request-scoped so each test gets a fresh module
    import, ensuring the cold-start log fires once per test where it
    matters.
    """
    fake_sentiment, fake_emotion, fake_keywords = _build_mock_inference()

    fake_pkg = MagicMock()
    fake_pkg.sentiment = fake_sentiment
    fake_pkg.emotion = fake_emotion
    fake_pkg.keywords = fake_keywords

    monkeypatch.setitem(sys.modules, "inference", fake_pkg)
    monkeypatch.setitem(sys.modules, "inference.sentiment", fake_sentiment)
    monkeypatch.setitem(sys.modules, "inference.emotion", fake_emotion)
    monkeypatch.setitem(sys.modules, "inference.keywords", fake_keywords)
    monkeypatch.delitem(sys.modules, "lambda_function", raising=False)

    import lambda_function  # noqa: PLC0415

    lambda_function._mocks = (fake_sentiment, fake_emotion, fake_keywords)
    return lambda_function


@pytest.fixture
def lambda_context():
    ctx = MagicMock()
    ctx.aws_request_id = "test-aws-request-id"
    return ctx


def make_event(method="POST", body=None, base64=False, raw_body=None):
    """Build a Function URL v2.0 event payload."""
    event = {
        "requestContext": {
            "http": {"method": method},
            "requestId": "test-function-url-req-id",
        },
        "isBase64Encoded": base64,
    }
    if raw_body is not None:
        event["body"] = raw_body
    elif body is not None:
        event["body"] = json.dumps(body)
    return event
