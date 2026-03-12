import logging
import os
import time
import uuid
import json
import importlib
from collections.abc import Iterator
from typing import Any

from apiflask import APIBlueprint
from flask import Response, abort, request, stream_with_context, g

from utils.auth import user_ad

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

ROOT_PATH_PROXY_LITELLM = "/proxy/litellm"

proxy_litellm = APIBlueprint("proxy_litellm", __name__)


def _json_logs_enabled() -> bool:
    value = os.getenv("LITELLM_JSON_LOGS", "true").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _log_event(event: str, **fields: Any) -> None:
    """Emit compact one-line JSON logs for easier log aggregation and querying."""
    if _json_logs_enabled():
        payload = {
            "component": "litellm_gateway",
            "event": event,
            **fields,
        }
        logger.info(json.dumps(payload, default=str, separators=(",", ":")))
        return

    logger.info("%s %s", event, fields)


def _serialize_event(event: Any) -> str:
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


def _event_to_dict(event: Any) -> dict[str, Any] | None:
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


def _input_metrics(payload: dict[str, Any]) -> tuple[int, int]:
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


def _response_metrics(response_obj: Any) -> dict[str, Any]:
    """Extract common response metadata such as id/model/token usage for logs."""
    payload_dict = _event_to_dict(response_obj) or {}
    usage_raw = payload_dict.get("usage")
    usage = usage_raw if isinstance(usage_raw, dict) else {}
    return {
        "response_id": payload_dict.get("id"),
        "response_model": payload_dict.get("model"),
        "usage_input_tokens": usage.get("input_tokens"),
        "usage_output_tokens": usage.get("output_tokens"),
        "usage_total_tokens": usage.get("total_tokens"),
    }


def _normalize_subpath(subpath: str) -> str:
    return subpath.strip().lstrip("/").rstrip("/")


def _load_litellm_module():
    try:
        return importlib.import_module("litellm")
    except Exception:
        return None


def _run_litellm_responses(payload: dict[str, Any]) -> Any:
    litellm = _load_litellm_module()
    if litellm is None:
        raise RuntimeError("litellm package is not installed")

    responses_fn = getattr(litellm, "responses", None)
    if not callable(responses_fn):
        responses_fn = getattr(litellm, "response", None)
    if not callable(responses_fn):
        raise RuntimeError("installed litellm version does not expose responses API")

    return responses_fn(**payload)


def _try_get_azure_ad_token() -> str | None:
    """Best-effort Azure AD token retrieval for Azure OpenAI requests."""
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        return token.token
    except Exception:
        return None


def _extract_bearer_token_from_request() -> str | None:
    """Return raw bearer token from Authorization header when present."""
    auth_header = request.headers.get("Authorization", "")
    if not isinstance(auth_header, str):
        return None

    parts = auth_header.strip().split(" ", 1)
    if len(parts) != 2:
        return None
    scheme, token = parts
    if scheme.lower() != "bearer":
        return None
    token = token.strip()
    return token or None


def _allow_forwarding_caller_bearer_token() -> bool:
    """Whether to forward caller bearer token to Azure OpenAI via LiteLLM."""
    value = os.getenv("LITELLM_FORWARD_CALLER_BEARER_TOKEN", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def _inject_mcp_transport_enabled() -> bool:
    """Whether to preserve/inject tools[].transport for MCP tool entries."""
    value = os.getenv("LITELLM_INJECT_MCP_TRANSPORT", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def get_litellm_auth_mode_summary() -> dict[str, Any]:
    """Return auth mode intent for startup diagnostics.

    This reports configured precedence (not runtime token validity).
    """
    has_api_key = bool((os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_API_KEY") or "").strip())
    caller_forwarding_enabled = _allow_forwarding_caller_bearer_token()

    return {
        "auth_priority": "api_key,dac,caller_bearer_opt_in",
        "has_api_key": has_api_key,
        "caller_bearer_forwarding": caller_forwarding_enabled,
        "expected_primary": "api_key" if has_api_key else "dac",
    }


def _apply_azure_defaults(payload: dict[str, Any], inbound_bearer_token: str | None = None) -> None:
    """Populate LiteLLM Azure params when model targets Azure provider."""
    model = payload.get("model")
    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()

    # If the client sends a bare model id (e.g., gpt-4.1-mini), route to the
    # configured provider-scoped default to avoid accidental OpenAI fallback.
    if (
        isinstance(model, str)
        and model.strip()
        and "/" not in model
        and default_model.lower().startswith("azure/")
    ):
        payload["model"] = default_model
        model = payload.get("model")

    model = payload.get("model")
    if not isinstance(model, str) or not model.strip().lower().startswith("azure/"):
        return

    api_base = os.getenv("AZURE_API_BASE") or os.getenv("AZURE_OPENAI_ENDPOINT")
    api_version = (
        os.getenv("AZURE_API_VERSION")
        or os.getenv("AZURE_OPENAI_VERSION")
        or "2025-03-01-preview"
    )

    if api_base and "api_base" not in payload:
        payload["api_base"] = api_base
    if api_version and "api_version" not in payload:
        payload["api_version"] = api_version

    # Prefer API key env vars if present.
    if "api_key" not in payload:
        api_key = os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_API_KEY")
        if api_key:
            payload["api_key"] = api_key

    # Next fallback: service identity via DefaultAzureCredential (matches /proxy/azure behavior).
    if "api_key" not in payload and "azure_ad_token" not in payload:
        token = _try_get_azure_ad_token()
        if token:
            payload["azure_ad_token"] = token

    # Optional final fallback: forward caller token only when explicitly enabled.
    if (
        "api_key" not in payload
        and "azure_ad_token" not in payload
        and _allow_forwarding_caller_bearer_token()
        and inbound_bearer_token
    ):
        payload["azure_ad_token"] = inbound_bearer_token


def _build_litellm_payload(req_id: str, user_oid: str) -> dict[str, Any]:
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        abort(400, "Expected JSON request body")

    # Propagate request context for traceability in LiteLLM logs and callbacks.
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
    metadata.update({"request_id": req_id, "user_oid": user_oid})
    payload["metadata"] = metadata

    # Normalize empty model strings from clients (e.g., model="") so fallback logic can apply.
    incoming_model = payload.get("model")
    if isinstance(incoming_model, str) and not incoming_model.strip():
        payload.pop("model", None)

    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()
    if not payload.get("model") and default_model:
        payload["model"] = default_model

    if not payload.get("model"):
        abort(500, "LiteLLM model missing: provide request model or set LITELLM_DEFAULT_MODEL")

    _apply_azure_defaults(payload, inbound_bearer_token=_extract_bearer_token_from_request())

    # Azure Responses rejects unknown parameter tools[].transport. Keep this off
    # by default and allow opt-in for environments that require transport hints.
    inject_transport = _inject_mcp_transport_enabled()
    default_mcp_transport = os.getenv("LITELLM_DEFAULT_MCP_TRANSPORT", "http").strip().lower()
    tools = payload.get("tools")
    if isinstance(tools, list):
        for tool in tools:
            if not isinstance(tool, dict):
                continue
            if tool.get("type") != "mcp":
                continue
            if not inject_transport:
                tool.pop("transport", None)
                continue
            transport = tool.get("transport")
            if isinstance(transport, str) and transport.strip():
                continue
            if default_mcp_transport in {"http", "sse", "stdio"}:
                tool["transport"] = default_mcp_transport

    return payload


def _extract_request_model() -> str | None:
    """Best-effort extraction of the requested model for structured logging."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None
    model = payload.get("model")
    if isinstance(model, str) and model.strip():
        return model.strip()
    return None


@proxy_litellm.get("/health")
def litellm_proxy_health():
    """Simple health endpoint to validate embedded LiteLLM configuration."""
    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()
    litellm = _load_litellm_module()
    if litellm is None:
        return {"status": "unhealthy", "reason": "litellm package not installed"}, 503
    if not default_model:
        return {"status": "unhealthy", "reason": "LITELLM_DEFAULT_MODEL missing"}, 503
    return {
        "status": "ok",
        "mode": "embedded",
        "default_model": default_model,
    }, 200


@proxy_litellm.post("<path:subpath>")
@user_ad.login_required
def litellm_proxy(subpath: str):
    """OpenAI-compatible proxy endpoint for LiteLLM.

    This endpoint is intended for the Playground flow and handles the
    OpenAI-compatible Responses API path via embedded LiteLLM.
    """
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start_time = time.perf_counter()

    normalized_subpath = _normalize_subpath(subpath)
    if normalized_subpath != "v1/responses":
        abort(404, "Embedded LiteLLM gateway supports only /v1/responses")

    user_token = g.user.token if hasattr(g, "user") and g.user and g.user.token else None
    user_oid = user_token.get("oid") if isinstance(user_token, dict) else "anon"

    payload = _build_litellm_payload(req_id=req_id, user_oid=str(user_oid))
    requested_model = _extract_request_model() or str(payload.get("model", "")).strip() or None
    input_items, input_chars = _input_metrics(payload)
    stream_enabled = bool(payload.get("stream"))

    _log_event(
        "request_start",
        req_id=req_id,
        user=str(user_oid),
        method=request.method,
        path=normalized_subpath,
        model=requested_model or "unknown",
        stream=stream_enabled,
        input_items=input_items,
        input_chars=input_chars,
    )

    try:
        response_or_stream = _run_litellm_responses(payload)

        if stream_enabled:
            stream_iterator = response_or_stream

            def generate_sse() -> Iterator[str]:
                event_count = 0
                final_usage: dict[str, Any] = {}
                response_id = None
                response_model = None
                try:
                    for event in stream_iterator:
                        event_count += 1
                        event_dict = _event_to_dict(event) or {}
                        response_payload_raw = event_dict.get("response")
                        if isinstance(response_payload_raw, dict):
                            response_payload = response_payload_raw
                            if response_id is None:
                                response_id = response_payload.get("id")
                            if response_model is None:
                                response_model = response_payload.get("model")
                            usage = response_payload.get("usage")
                            if isinstance(usage, dict):
                                final_usage = usage
                        yield f"data: {_serialize_event(event)}\n\n"
                    yield "data: [DONE]\n\n"
                finally:
                    _log_event(
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
                    )

            return Response(
                stream_with_context(generate_sse()),
                content_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                    "X-Request-Id": req_id,
                },
            )

        serialized_response = _serialize_event(response_or_stream)
        metrics = _response_metrics(response_or_stream)
        _log_event(
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
        )
        return Response(
            serialized_response,
            status=200,
            content_type="application/json",
            headers={"X-Request-Id": req_id},
        )
    except Exception:
        _log_event(
            "response_error",
            req_id=req_id,
            status=500,
            latency_ms=round((time.perf_counter() - start_time) * 1000, 1),
            model=requested_model or "unknown",
        )
        logger.exception("LiteLLM embedded exception req_id=%s", req_id)
        return Response("Proxy error", status=502)
