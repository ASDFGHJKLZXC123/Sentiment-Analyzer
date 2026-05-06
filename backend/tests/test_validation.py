"""Validation precedence and error-shape tests with mocked inference.

Spec validation order is contractual:
    method -> base64 decode -> JSON parse/object -> schema/business
"""

import base64
import json

import pytest

from tests.conftest import make_event


def _error_body(response):
    return json.loads(response["body"])["error"]


# 1. Method check happens first.
@pytest.mark.parametrize("method", ["GET", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"])
def test_non_post_returns_405_with_allow_header(handler_module, lambda_context, method):
    event = make_event(method=method, body={"text": "hi"})
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 405
    assert response["headers"]["Allow"] == "POST"
    err = _error_body(response)
    assert err["code"] == "METHOD_NOT_ALLOWED"
    assert err["field"] == "method"


def test_405_takes_precedence_over_bad_json(handler_module, lambda_context):
    event = make_event(method="GET", raw_body="this-is-not-json")
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 405


def test_405_takes_precedence_over_too_long_text(handler_module, lambda_context):
    event = make_event(method="GET", body={"text": "x" * 6000})
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 405


# 2. Base64 decode failure precedes JSON parse.
def test_base64_invalid_returns_400_invalid_json(handler_module, lambda_context):
    event = make_event(raw_body="!!!not-base64!!!", base64=True)
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "INVALID_JSON"


def test_base64_decoded_to_invalid_json(handler_module, lambda_context):
    encoded = base64.b64encode(b"not-json").decode()
    event = make_event(raw_body=encoded, base64=True)
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "INVALID_JSON"


# 3. JSON parse + object check.
def test_invalid_json_returns_400(handler_module, lambda_context):
    event = make_event(raw_body="{not valid json")
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "INVALID_JSON"


def test_missing_body_returns_400_invalid_json(handler_module, lambda_context):
    event = {
        "requestContext": {"http": {"method": "POST"}, "requestId": "x"},
        "isBase64Encoded": False,
    }
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "INVALID_JSON"


@pytest.mark.parametrize("payload", ["[]", "[1, 2, 3]", '"a string"', "42", "true", "null"])
def test_non_object_json_returns_400_invalid_json(handler_module, lambda_context, payload):
    event = make_event(raw_body=payload)
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "INVALID_JSON"


# 4. Schema/business validation.
@pytest.mark.parametrize("text", ["", "   ", "\t\n  ", None])
def test_empty_or_missing_text_returns_400(handler_module, lambda_context, text):
    event = make_event(body={"text": text} if text is not None else {})
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "EMPTY_INPUT"


@pytest.mark.parametrize("wrong_type", [42, 3.14, True, [], {}])
def test_wrong_type_text_returns_400_empty_input(handler_module, lambda_context, wrong_type):
    """A non-string text fails the schema check; closest defined code
    is EMPTY_INPUT (per spec: 'text missing' covers wrong type)."""
    event = make_event(body={"text": wrong_type})
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "EMPTY_INPUT"


def test_text_at_5000_chars_succeeds(handler_module, lambda_context):
    event = make_event(body={"text": "x" * 5000})
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 200


def test_text_over_5000_chars_returns_422(handler_module, lambda_context):
    event = make_event(body={"text": "x" * 5001})
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 422
    err = _error_body(response)
    assert err["code"] == "INPUT_TOO_LONG"
    assert err["field"] == "text"


# Integration: precedence sanity — POST + bad JSON returns INVALID_JSON,
# never reaches schema validation.
def test_post_bad_json_returns_invalid_json_not_empty_input(handler_module, lambda_context):
    event = make_event(raw_body='{"text":')  # truncated JSON
    response = handler_module.handler(event, lambda_context)
    assert response["statusCode"] == 400
    assert _error_body(response)["code"] == "INVALID_JSON"
