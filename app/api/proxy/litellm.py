"""Flask route layer for the embedded LiteLLM gateway.

This module owns HTTP concerns (routing, request/response objects, and status
codes) and delegates business logic to sibling modules:
- `litellm_proxy.py` for payload/provider behavior
- `litellm_logging.py` for structured logging helpers
"""

import logging
import os
import time
import uuid
from collections.abc import Iterator
from typing import Any

from apiflask import APIBlueprint
from flask import Response, abort, g, request, stream_with_context
import litellm
from werkzeug.exceptions import HTTPException

from utils.auth import user_ad
from .litellm_logging import (
    event_to_dict,
    get_gateway_metrics_snapshot,
    input_metrics,
    log_event,
    record_gateway_metrics,
    response_metrics,
    serialize_event,
    tool_metrics,
)
from .litellm_proxy import (
    build_litellm_payload,
    extract_bearer_token_from_auth_header,
    normalize_subpath,
    PayloadValidationError,
    resolve_requested_model,
    resolve_litellm_responses_fn,
    run_litellm_responses,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

ROOT_PATH_PROXY_LITELLM = "/proxy/litellm"

proxy_litellm = APIBlueprint("proxy_litellm", __name__)


def _extract_execution_metadata(payload: dict[str, Any] | None) -> dict[str, Any]:
    """Extract execution metadata injected by the proxy runtime for diagnostics."""
    if not isinstance(payload, dict):
        return {"selected_model": None, "attempts": 1, "fallback_used": False}

    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        return {"selected_model": None, "attempts": 1, "fallback_used": False}

    execution = metadata.get("litellm_proxy_execution")
    if not isinstance(execution, dict):
        return {"selected_model": None, "attempts": 1, "fallback_used": False}

    attempts = execution.get("attempts")
    attempts_value = attempts if isinstance(attempts, int) and attempts > 0 else 1
    return {
        "selected_model": execution.get("selected_model") if isinstance(execution.get("selected_model"), str) else None,
        "attempts": attempts_value,
        "fallback_used": bool(execution.get("fallback_used", False)),
    }


def _log_response_error(
    req_id: str,
    start_time: float,
    requested_model: str | None,
    payload_tool_metrics: dict[str, Any],
    status: int,
) -> None:
    """Emit a consistent error log shape for all response failures."""
    log_event(
        "response_error",
        req_id=req_id,
        status=status,
        latency_ms=round((time.perf_counter() - start_time) * 1000, 1),
        model=requested_model or "unknown",
        tools_count=payload_tool_metrics["tools_count"],
        tool_names=payload_tool_metrics["tool_names"],
        tool_types=payload_tool_metrics["tool_types"],
    )


@proxy_litellm.get("/health")
def litellm_proxy_health():
    """Simple health endpoint to validate embedded LiteLLM configuration."""
    responses_fn = resolve_litellm_responses_fn()
    if responses_fn is None:
        return {"status": "unhealthy", "reason": "litellm responses API unavailable"}, 503

    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()
    if not default_model:
        return {"status": "unhealthy", "reason": "LITELLM_DEFAULT_MODEL missing"}, 503

    litellm_version = str(getattr(litellm, "__version__", "unknown"))
    return {
        "status": "ok",
        "mode": "embedded",
        "default_model": default_model,
        "litellm_version": litellm_version,
    }, 200


@proxy_litellm.get("/metrics")
@user_ad.login_required
def litellm_proxy_metrics():
    """Diagnostics endpoint exposing in-memory proxy metrics for Playground troubleshooting."""
    return get_gateway_metrics_snapshot(), 200


@proxy_litellm.post("<path:subpath>")
@user_ad.login_required
def litellm_proxy(subpath: str):
    """OpenAI-compatible proxy endpoint for LiteLLM.

    This endpoint is intended for the Playground flow and handles the
    OpenAI-compatible Responses API path via embedded LiteLLM.
    """
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start_time = time.perf_counter()

    normalized_subpath = normalize_subpath(subpath)
    if normalized_subpath != "v1/responses":
        abort(404, "Embedded LiteLLM gateway supports only /v1/responses")

    user_token = g.user.token if hasattr(g, "user") and g.user and g.user.token else None
    user_oid = user_token.get("oid") if isinstance(user_token, dict) else "anon"

    payload: dict[str, Any] | None = None
    requested_model: str | None = None
    payload_tool_metrics: dict[str, Any] = {
        "tools_count": 0,
        "tool_names": [],
        "tool_types": [],
    }

    try:
        payload = build_litellm_payload(
            payload=request.get_json(silent=True),
            req_id=req_id,
            user_oid=str(user_oid),
            inbound_bearer_token=extract_bearer_token_from_auth_header(request.headers.get("Authorization")),
        )
        requested_model = resolve_requested_model(payload)
        input_items, input_chars = input_metrics(payload)
        payload_tool_metrics = tool_metrics(payload)
        stream_enabled = bool(payload.get("stream"))

        log_event(
            "request_start",
            req_id=req_id,
            user=str(user_oid),
            method=request.method,
            path=normalized_subpath,
            model=requested_model or "unknown",
            stream=stream_enabled,
            input_items=input_items,
            input_chars=input_chars,
            tools_count=payload_tool_metrics["tools_count"],
            tool_names=payload_tool_metrics["tool_names"],
            tool_types=payload_tool_metrics["tool_types"],
        )

        response_or_stream = run_litellm_responses(payload)
        execution = _extract_execution_metadata(payload)

        if stream_enabled:
            # Keep a local alias so the closure only captures what it needs.
            stream_iterator = response_or_stream

            def generate_sse() -> Iterator[str]:
                """Yield LiteLLM stream chunks as OpenAI-style SSE frames."""
                event_count = 0
                final_usage: dict[str, Any] = {}
                response_id = None
                response_model = None
                try:
                    for event in stream_iterator:
                        event_count += 1
                        event_dict = event_to_dict(event) or {}
                        response_payload_raw = event_dict.get("response")
                        if isinstance(response_payload_raw, dict):
                            response_payload = response_payload_raw
                            if response_id is None:
                                response_id = response_payload.get("id")
                            if response_model is None:
                                response_model = response_payload.get("model")
                            usage = response_payload.get("usage")
                            if isinstance(usage, dict):
                                # Track the last usage object observed in the stream.
                                final_usage = usage
                        yield f"data: {serialize_event(event)}\n\n"
                    yield "data: [DONE]\n\n"
                finally:
                    # Emit completion metrics even if the client disconnects early.
                    log_event(
                        "stream_done",
                        req_id=req_id,
                        status=200,
                        latency_ms=round((time.perf_counter() - start_time) * 1000, 1),
                        model=requested_model or "unknown",
                        event_count=event_count,
                        response_id=response_id,
                        response_model=response_model,
                        usage_input_tokens=final_usage.get("input_tokens"),
                        usage_output_tokens=final_usage.get("output_tokens"),
                        usage_total_tokens=final_usage.get("total_tokens"),
                        tools_count=payload_tool_metrics["tools_count"],
                        tool_names=payload_tool_metrics["tool_names"],
                        tool_types=payload_tool_metrics["tool_types"],
                        attempt_count=execution["attempts"],
                        selected_model=execution["selected_model"],
                        fallback_used=execution["fallback_used"],
                    )
                    record_gateway_metrics(
                        request_id=req_id,
                        status=200,
                        stream=True,
                        selected_model=execution["selected_model"] or requested_model,
                        attempts=execution["attempts"],
                        fallback_used=execution["fallback_used"],
                    )

            return Response(
                stream_with_context(generate_sse()),
                content_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "X-Request-Id": req_id,
                    "X-LiteLLM-Attempts": str(execution["attempts"]),
                    "X-LiteLLM-Fallback-Used": str(execution["fallback_used"]).lower(),
                },
            )

        serialized_response = serialize_event(response_or_stream)
        metrics = response_metrics(response_or_stream)
        log_event(
            "response_done",
            req_id=req_id,
            status=200,
            latency_ms=round((time.perf_counter() - start_time) * 1000, 1),
            model=requested_model or "unknown",
            response_id=metrics.get("response_id"),
            response_model=metrics.get("response_model"),
            usage_input_tokens=metrics.get("usage_input_tokens"),
            usage_output_tokens=metrics.get("usage_output_tokens"),
            usage_total_tokens=metrics.get("usage_total_tokens"),
            tools_count=payload_tool_metrics["tools_count"],
            tool_names=payload_tool_metrics["tool_names"],
            tool_types=payload_tool_metrics["tool_types"],
            attempt_count=execution["attempts"],
            selected_model=execution["selected_model"],
            fallback_used=execution["fallback_used"],
        )
        record_gateway_metrics(
            request_id=req_id,
            status=200,
            stream=False,
            selected_model=execution["selected_model"] or requested_model,
            attempts=execution["attempts"],
            fallback_used=execution["fallback_used"],
        )
        return Response(
            serialized_response,
            status=200,
            content_type="application/json",
            headers={
                "X-Request-Id": req_id,
                "X-LiteLLM-Attempts": str(execution["attempts"]),
                "X-LiteLLM-Fallback-Used": str(execution["fallback_used"]).lower(),
            },
        )
    except PayloadValidationError as validation_error:
        execution = _extract_execution_metadata(payload)
        record_gateway_metrics(
            request_id=req_id,
            status=validation_error.status_code,
            stream=bool(payload and payload.get("stream")),
            selected_model=execution["selected_model"] or requested_model,
            attempts=execution["attempts"],
            fallback_used=execution["fallback_used"],
        )
        _log_response_error(req_id, start_time, requested_model, payload_tool_metrics, validation_error.status_code)
        return Response(str(validation_error.message), status=validation_error.status_code, headers={"X-Request-Id": req_id})
    except HTTPException as http_error:
        status_code = http_error.code or 500
        description = http_error.description or "Request validation failed"
        execution = _extract_execution_metadata(payload)
        record_gateway_metrics(
            request_id=req_id,
            status=status_code,
            stream=bool(payload and payload.get("stream")),
            selected_model=execution["selected_model"] or requested_model,
            attempts=execution["attempts"],
            fallback_used=execution["fallback_used"],
        )
        _log_response_error(req_id, start_time, requested_model, payload_tool_metrics, status_code)
        return Response(str(description), status=status_code, headers={"X-Request-Id": req_id})
    except Exception:
        execution = _extract_execution_metadata(payload)
        record_gateway_metrics(
            request_id=req_id,
            status=500,
            stream=bool(payload and payload.get("stream")),
            selected_model=execution["selected_model"] or requested_model,
            attempts=execution["attempts"],
            fallback_used=execution["fallback_used"],
        )
        _log_response_error(req_id, start_time, requested_model, payload_tool_metrics, 500)
        logger.exception("LiteLLM embedded exception req_id=%s", req_id)
        return Response("Proxy error", status=502)
