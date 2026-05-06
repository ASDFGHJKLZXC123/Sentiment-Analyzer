"""Phase 2 Lambda handler — Function URL payload v2.0.

Public contract (full spec in docs/phase2-backend.md):

- POST application/json {"text": "..."}        -> 200 success envelope
- non-POST                                     -> 405 METHOD_NOT_ALLOWED + Allow: POST
- text missing/empty/whitespace/wrong type     -> 400 EMPTY_INPUT
- text > 5000 characters                       -> 422 INPUT_TOO_LONG
- bad/non-object JSON, base64 decode failures  -> 400 INVALID_JSON

Validation precedence is contractual:
  method -> base64 decode -> JSON parse/object -> schema/business
"""

import base64
import json
import logging
import os
import time
from datetime import datetime, timezone

LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO").upper()
logger = logging.getLogger()
logger.setLevel(LOG_LEVEL)

_INIT_T0 = time.perf_counter()

from inference import emotion, keywords, sentiment

_INIT_ELAPSED_MS = round((time.perf_counter() - _INIT_T0) * 1000)

logger.info(json.dumps({
    "event": "cold_start",
    "sentimentModel": sentiment.MODEL_ID,
    "sentimentRevision": sentiment.MODEL_REVISION,
    "emotionModel": emotion.MODEL_ID,
    "emotionRevision": emotion.MODEL_REVISION,
    "initElapsedMs": _INIT_ELAPSED_MS,
}))

MAX_TEXT_LENGTH = 5000
ECHO_MAX_LENGTH = 200


def _response(status_code: int, body: dict, extra_headers: dict | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if extra_headers:
        headers.update(extra_headers)
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body),
        "isBase64Encoded": False,
    }


def _error(code: str, message: str, field: str, status_code: int,
           extra_headers: dict | None = None) -> dict:
    return _response(
        status_code,
        {"error": {"code": code, "message": message, "field": field}},
        extra_headers,
    )


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def handler(event: dict, context) -> dict:
    started = time.perf_counter()
    request_context = event.get("requestContext", {}) or {}
    method = request_context.get("http", {}).get("method", "").upper()
    aws_request_id = getattr(context, "aws_request_id", None)
    function_url_request_id = request_context.get("requestId")

    def _finish(response, *, input_length=0, inference_ms=None, error_code=None):
        record = {
            "event": "request",
            "awsRequestId": aws_request_id,
            "functionUrlRequestId": function_url_request_id,
            "method": method or "(missing)",
            "statusCode": response["statusCode"],
            "inputLength": input_length,
            "totalElapsedMs": round((time.perf_counter() - started) * 1000),
        }
        if error_code is not None:
            record["errorCode"] = error_code
        if inference_ms is not None:
            record["inferenceElapsedMs"] = inference_ms
        logger.info(json.dumps(record))
        return response

    if method != "POST":
        return _finish(
            _error(
                "METHOD_NOT_ALLOWED",
                "This endpoint only accepts POST requests.",
                "method",
                405,
                {"Allow": "POST"},
            ),
            error_code="METHOD_NOT_ALLOWED",
        )

    body = event.get("body")
    if event.get("isBase64Encoded") and body:
        try:
            body = base64.b64decode(body).decode("utf-8")
        except (ValueError, UnicodeDecodeError):
            return _finish(
                _error("INVALID_JSON", "Request body could not be base64-decoded.", "text", 400),
                error_code="INVALID_JSON",
            )

    if not body or not body.strip():
        return _finish(
            _error("INVALID_JSON", "Request body is required.", "text", 400),
            error_code="INVALID_JSON",
        )

    try:
        parsed = json.loads(body)
    except json.JSONDecodeError:
        return _finish(
            _error("INVALID_JSON", "Request body is not valid JSON.", "text", 400),
            error_code="INVALID_JSON",
        )

    if not isinstance(parsed, dict):
        return _finish(
            _error("INVALID_JSON", "Request body must be a JSON object.", "text", 400),
            error_code="INVALID_JSON",
        )

    text = parsed.get("text")
    if not isinstance(text, str) or not text.strip():
        return _finish(
            _error(
                "EMPTY_INPUT",
                "Field 'text' is required and cannot be empty or whitespace-only.",
                "text",
                400,
            ),
            error_code="EMPTY_INPUT",
            input_length=len(text) if isinstance(text, str) else 0,
        )

    if len(text) > MAX_TEXT_LENGTH:
        return _finish(
            _error(
                "INPUT_TOO_LONG",
                f"Field 'text' exceeds {MAX_TEXT_LENGTH} characters.",
                "text",
                422,
            ),
            error_code="INPUT_TOO_LONG",
            input_length=len(text),
        )

    inference_t0 = time.perf_counter()
    result = {
        "sentiment": sentiment.analyze(text),
        "emotions": emotion.analyze(text),
        "keywords": keywords.analyze(text),
        "inputText": text[:ECHO_MAX_LENGTH],
        "analyzedAt": _now_iso(),
    }
    inference_ms = round((time.perf_counter() - inference_t0) * 1000)
    return _finish(_response(200, result), input_length=len(text), inference_ms=inference_ms)
