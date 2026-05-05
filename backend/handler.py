"""Phase 1 stub Lambda handler.

Returns a fixed JSON response so we can prove the container build,
Lambda Function URL wiring, and CORS work end-to-end before the real
inference code lands in Phase 2.
"""

import json
from datetime import datetime, timezone


def handler(event, context):
    body = {
        "ok": True,
        "phase": 1,
        "message": "Sentiment Analyzer stub responded.",
        "respondedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
    }
    return {
        "statusCode": 200,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
        },
        "body": json.dumps(body),
    }
