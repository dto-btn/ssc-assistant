import os
from collections.abc import Callable
from typing import Any

from flask import abort, request
import litellm


ProviderDefaultsHandler = Callable[[dict[str, Any], str | None], None]


def normalize_subpath(subpath: str) -> str:
    return subpath.strip().lstrip("/").rstrip("/")


def run_litellm_responses(payload: dict[str, Any]) -> Any:
    responses_fn = getattr(litellm, "responses", None)
    if not callable(responses_fn):
        responses_fn = getattr(litellm, "response", None)
    if not callable(responses_fn):
        raise RuntimeError("installed litellm version does not expose responses API")

    return responses_fn(**payload)


def resolve_litellm_responses_fn() -> Any:
    """Return the LiteLLM responses callable used by this gateway."""
    responses_fn = getattr(litellm, "responses", None)
    if callable(responses_fn):
        return responses_fn

    responses_fn = getattr(litellm, "response", None)
    if callable(responses_fn):
        return responses_fn

    return None


def _extract_provider_from_model(model: str | None) -> str | None:
    if not isinstance(model, str):
        return None
    normalized = model.strip().lower()
    if not normalized or "/" not in normalized:
        return None
    provider = normalized.split("/", 1)[0].strip()
    return provider or None


def _resolve_effective_model(payload: dict[str, Any]) -> None:
    """Resolve fallback/default model and normalize bare model names.

    If the request sends a bare model (no provider prefix) and the configured
    default model is provider-scoped (provider/model), we route to that default.
    This keeps current Azure behavior and enables the same pattern for any
    provider configured in LITELLM_DEFAULT_MODEL.
    """
    current_model = payload.get("model")
    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()

    if not current_model and default_model:
        payload["model"] = default_model
        return

    if not isinstance(current_model, str) or not current_model.strip():
        return

    if "/" in current_model:
        return

    if _extract_provider_from_model(default_model):
        payload["model"] = default_model


def _try_get_azure_ad_token() -> str | None:
    """Best-effort Azure AD token retrieval for Azure OpenAI requests."""
    try:
        from azure.identity import DefaultAzureCredential

        credential = DefaultAzureCredential()
        token = credential.get_token("https://cognitiveservices.azure.com/.default")
        return token.token
    except Exception:
        return None


def extract_bearer_token_from_request() -> str | None:
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


def allow_forwarding_caller_bearer_token() -> bool:
    """Whether to forward caller bearer token to Azure OpenAI via LiteLLM."""
    value = os.getenv("LITELLM_FORWARD_CALLER_BEARER_TOKEN", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def inject_mcp_transport_enabled() -> bool:
    """Whether to preserve/inject tools[].transport for MCP tool entries."""
    value = os.getenv("LITELLM_INJECT_MCP_TRANSPORT", "false").strip().lower()
    return value in {"1", "true", "yes", "on"}


def get_litellm_auth_mode_summary() -> dict[str, Any]:
    """Return auth mode intent for startup diagnostics.

    This reports configured precedence (not runtime token validity).
    """
    has_api_key = bool((os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_API_KEY") or "").strip())
    caller_forwarding_enabled = allow_forwarding_caller_bearer_token()
    default_model = os.getenv("LITELLM_DEFAULT_MODEL", "").strip()
    default_provider = _extract_provider_from_model(default_model)

    return {
        "auth_priority": "api_key,dac,caller_bearer_opt_in",
        "has_api_key": has_api_key,
        "caller_bearer_forwarding": caller_forwarding_enabled,
        "expected_primary": "api_key" if has_api_key else "dac",
        "default_provider": default_provider or "unscoped",
        "supported_provider_defaults": ["anthropic", "azure", "openai", "vertex_ai"],
    }


def _apply_azure_defaults(payload: dict[str, Any], inbound_bearer_token: str | None = None) -> None:
    """Populate LiteLLM Azure params when model targets Azure provider."""
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
        and allow_forwarding_caller_bearer_token()
        and inbound_bearer_token
    ):
        payload["azure_ad_token"] = inbound_bearer_token


def _apply_noop_provider_defaults(payload: dict[str, Any], inbound_bearer_token: str | None = None) -> None:
    """Provider placeholder for non-Azure providers.

    LiteLLM handles standard env vars for most providers directly. This hook is
    intentionally a no-op and exists so provider-specific defaults can be added
    without touching request orchestration.
    """
    _ = payload
    _ = inbound_bearer_token


PROVIDER_DEFAULT_HANDLERS: dict[str, ProviderDefaultsHandler] = {
    "anthropic": _apply_noop_provider_defaults,
    "azure": _apply_azure_defaults,
    "openai": _apply_noop_provider_defaults,
    "vertex_ai": _apply_noop_provider_defaults,
}


def _apply_provider_defaults(payload: dict[str, Any], inbound_bearer_token: str | None = None) -> None:
    provider = _extract_provider_from_model(payload.get("model"))
    if not provider:
        return

    handler = PROVIDER_DEFAULT_HANDLERS.get(provider)
    if handler is None:
        return
    handler(payload, inbound_bearer_token)


def build_litellm_payload(req_id: str, user_oid: str) -> dict[str, Any]:
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

    _resolve_effective_model(payload)

    if not payload.get("model"):
        abort(500, "LiteLLM model missing: provide request model or set LITELLM_DEFAULT_MODEL")

    _apply_provider_defaults(payload, inbound_bearer_token=extract_bearer_token_from_request())

    # Azure Responses rejects unknown parameter tools[].transport. Keep this off
    # by default and allow opt-in for environments that require transport hints.
    inject_transport = inject_mcp_transport_enabled()
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


def extract_request_model() -> str | None:
    """Best-effort extraction of the requested model for structured logging."""
    payload = request.get_json(silent=True)
    if not isinstance(payload, dict):
        return None
    model = payload.get("model")
    if isinstance(model, str) and model.strip():
        return model.strip()
    return None
