"""Structured logging and metrics extraction utilities for LiteLLM gateway."""

import json
import logging
import os
import threading
import time
from typing import Any

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_METRICS_LOCK = threading.Lock()
_GATEWAY_METRICS: dict[str, Any] = {
    "total_requests": 0,
    "total_success": 0,
    "total_errors": 0,
    "total_stream_requests": 0,
    "total_non_stream_requests": 0,
    "total_retries": 0,
    "total_fallbacks": 0,
    "last_request_id": None,
    "last_model": None,
    "last_status": None,
    "updated_at": None,
}


def json_logs_enabled() -> bool:
    """Return whether JSON line logging is enabled for LiteLLM gateway events."""
    value = os.getenv("LITELLM_JSON_LOGS", "true").strip().lower()
    return value in {"1", "true", "yes", "on"}


def metrics_enabled() -> bool:
    """Return whether in-memory LiteLLM gateway metrics tracking is enabled."""
    value = os.getenv("LITELLM_ENABLE_METRICS", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def reset_gateway_metrics() -> None:
    """Reset in-memory counters. Intended for tests and local diagnostics."""
    with _METRICS_LOCK:
        _GATEWAY_METRICS.update(
            {
                "total_requests": 0,
                "total_success": 0,
                "total_errors": 0,
                "total_stream_requests": 0,
                "total_non_stream_requests": 0,
                "total_retries": 0,
                "total_fallbacks": 0,
                "last_request_id": None,
                "last_model": None,
                "last_status": None,
                "updated_at": None,
            }
        )


def record_gateway_metrics(
    *,
    request_id: str,
    status: int,
    stream: bool,
    selected_model: str | None,
    attempts: int,
    fallback_used: bool,
) -> None:
    """Update aggregate in-memory counters for Playground LiteLLM diagnostics."""
    if not metrics_enabled():
        return

    retries = max(attempts - 1, 0)
    with _METRICS_LOCK:
        _GATEWAY_METRICS["total_requests"] += 1
        if 200 <= status < 400:
            _GATEWAY_METRICS["total_success"] += 1
        else:
            _GATEWAY_METRICS["total_errors"] += 1

        if stream:
            _GATEWAY_METRICS["total_stream_requests"] += 1
        else:
            _GATEWAY_METRICS["total_non_stream_requests"] += 1

        _GATEWAY_METRICS["total_retries"] += retries
        if fallback_used:
            _GATEWAY_METRICS["total_fallbacks"] += 1

        _GATEWAY_METRICS["last_request_id"] = request_id
        _GATEWAY_METRICS["last_model"] = selected_model
        _GATEWAY_METRICS["last_status"] = status
        _GATEWAY_METRICS["updated_at"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def get_gateway_metrics_snapshot() -> dict[str, Any]:
    """Return a JSON-safe snapshot of current gateway diagnostics counters."""
    with _METRICS_LOCK:
        counters = dict(_GATEWAY_METRICS)

    return {
        "enabled": metrics_enabled(),
        "counters": counters,
    }


def log_event(event: str, **fields: Any) -> None:
    """Emit compact one-line JSON logs for easier log aggregation and querying."""
    if json_logs_enabled():
        payload = {
            "component": "litellm_gateway",
            "event": event,
            **fields,
        }
        logger.info(json.dumps(payload, default=str, separators=(",", ":")))
        return

    logger.info("%s %s", event, fields)


def serialize_event(event: Any) -> str:
    """Convert LiteLLM event objects into JSON for SSE transport."""
    if isinstance(event, str):
        return event
    if isinstance(event, dict):
        return json.dumps(event)

    model_dump_json = getattr(event, "model_dump_json", None)
    if callable(model_dump_json):
        dumped = model_dump_json()
        return dumped if isinstance(dumped, str) else json.dumps(dumped)

    model_dump = getattr(event, "model_dump", None)
    if callable(model_dump):
        return json.dumps(model_dump())

    to_dict = getattr(event, "to_dict", None)
    if callable(to_dict):
        return json.dumps(to_dict())

    return json.dumps({"event": str(event)})


def event_to_dict(event: Any) -> dict[str, Any] | None:
    """Best-effort conversion of streaming events to dict for metrics extraction."""
    if isinstance(event, dict):
        return event

    model_dump = getattr(event, "model_dump", None)
    if callable(model_dump):
        dumped = model_dump()
        return dumped if isinstance(dumped, dict) else None

    to_dict = getattr(event, "to_dict", None)
    if callable(to_dict):
        dumped = to_dict()
        return dumped if isinstance(dumped, dict) else None

    return None


def input_metrics(payload: dict[str, Any]) -> tuple[int, int]:
    """Return item count and approximate character size for request input logging."""
    input_value = payload.get("input")
    if input_value is None:
        return 0, 0
    if isinstance(input_value, str):
        return 1, len(input_value)
    if isinstance(input_value, list):
        try:
            encoded = json.dumps(input_value)
        except Exception:
            encoded = str(input_value)
        return len(input_value), len(encoded)
    encoded = str(input_value)
    return 1, len(encoded)


def _extract_tool_name(tool: dict[str, Any]) -> str | None:
    """Best-effort extraction of a human-readable tool identifier."""
    tool_type = str(tool.get("type") or "").strip().lower()

    if tool_type == "function":
        fn = tool.get("function")
        if isinstance(fn, dict):
            name = fn.get("name")
            if isinstance(name, str) and name.strip():
                return name.strip()

    for key in ("name", "server_label", "server", "url"):
        value = tool.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()

    if tool_type:
        return tool_type
    return None


def tool_metrics(payload: dict[str, Any]) -> dict[str, Any]:
    """Extract structured tool metadata for log filtering."""
    tools = payload.get("tools")
    if not isinstance(tools, list):
        return {
            "tools_count": 0,
            "tool_names": [],
            "tool_types": [],
        }

    tool_names: list[str] = []
    tool_types: list[str] = []
    for tool in tools:
        if not isinstance(tool, dict):
            continue

        tool_type = str(tool.get("type") or "").strip().lower()
        if tool_type and tool_type not in tool_types:
            tool_types.append(tool_type)

        tool_name = _extract_tool_name(tool)
        if tool_name and tool_name not in tool_names:
            tool_names.append(tool_name)

    return {
        "tools_count": len(tools),
        "tool_names": tool_names,
        "tool_types": tool_types,
    }


def response_metrics(response_obj: Any) -> dict[str, Any]:
    """Extract common response metadata such as id/model/token usage for logs."""
    payload_dict = event_to_dict(response_obj) or {}
    usage_raw = payload_dict.get("usage")
    usage = usage_raw if isinstance(usage_raw, dict) else {}
    return {
        "response_id": payload_dict.get("id"),
        "response_model": payload_dict.get("model"),
        "usage_input_tokens": usage.get("input_tokens"),
        "usage_output_tokens": usage.get("output_tokens"),
        "usage_total_tokens": usage.get("total_tokens"),
    }
