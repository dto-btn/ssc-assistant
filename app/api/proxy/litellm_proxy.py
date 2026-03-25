"""Provider-aware payload preparation utilities for embedded LiteLLM gateway.

This module keeps request shaping separate from Flask routing and provides a
small provider dispatch layer so new providers can be added without changing
the main request flow.
"""

import os
import time
from collections.abc import Callable
from typing import Any

import litellm


# Signature for provider-specific payload mutators.
ProviderDefaultsHandler = Callable[[dict[str, Any], str | None], None]


class PayloadValidationError(Exception):
    """Validation error raised while preparing LiteLLM payload."""

    def __init__(self, status_code: int, message: str) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.message = message


class GatewayAdapter:
    """Gateway execution contract to ease future runtime swaps."""

    def resolve_responses_fn(self) -> Any:
        raise NotImplementedError

    def run_responses(self, payload: dict[str, Any]) -> Any:
        raise NotImplementedError


class EmbeddedLiteLLMGatewayAdapter(GatewayAdapter):
    """In-process gateway implementation backed by installed LiteLLM package."""

    def resolve_responses_fn(self) -> Any:
        responses_fn = getattr(litellm, "responses", None)
        if callable(responses_fn):
            return responses_fn

        responses_fn = getattr(litellm, "response", None)
        if callable(responses_fn):
            return responses_fn

        return None

    def run_responses(self, payload: dict[str, Any]) -> Any:
        responses_fn = self.resolve_responses_fn()
        if not callable(responses_fn):
            raise RuntimeError("installed litellm version does not expose responses API")
        return responses_fn(**payload)


class StandaloneHttpGatewayAdapter(GatewayAdapter):
    """Placeholder adapter for future standalone LiteLLM gateway mode.

    This adapter is intentionally minimal in this iteration so runtime behavior
    stays unchanged unless explicitly selected via configuration.
    """

    def resolve_responses_fn(self) -> Any:
        # A remote gateway does not expose a local callable in-process.
        return None

    def run_responses(self, payload: dict[str, Any]) -> Any:
        _ = payload
        raise RuntimeError(
            "standalone_http adapter is not implemented yet; use LITELLM_GATEWAY_MODE=embedded"
        )


def get_gateway_adapter() -> GatewayAdapter:
    """Return runtime-selected gateway adapter.

    Currently only embedded mode is implemented. The interface exists so a
    standalone transport adapter can be added without route-layer changes.
    """
    mode = os.getenv("LITELLM_GATEWAY_MODE", "embedded").strip().lower()
    if mode == "embedded":
        return EmbeddedLiteLLMGatewayAdapter()
    if mode == "standalone_http":
        return StandaloneHttpGatewayAdapter()
    raise RuntimeError(f"unsupported LITELLM_GATEWAY_MODE: {mode}")


def normalize_subpath(subpath: str) -> str:
    """Normalize a Flask subpath for strict endpoint matching."""
    return subpath.strip().lstrip("/").rstrip("/")


def run_litellm_responses(payload: dict[str, Any]) -> Any:
    """Invoke Responses API through selected gateway adapter with optional retry/fallback policy."""
    adapter = get_gateway_adapter()

    # Keep streaming behavior stable: stream-level retries need event-aware handling.
    if bool(payload.get("stream")):
        _set_execution_metadata(
            payload,
            selected_model=payload.get("model") if isinstance(payload.get("model"), str) else None,
            attempts=1,
            fallback_used=False,
        )
        return adapter.run_responses(payload)

    retry_enabled = _env_flag("LITELLM_ENABLE_RETRY", "false")
    retry_max_attempts = _env_int("LITELLM_RETRY_MAX_ATTEMPTS", default=1, min_value=1, max_value=10)
    retry_backoff_ms = _env_int("LITELLM_RETRY_BACKOFF_MS", default=250, min_value=0, max_value=30_000)
    model_candidates = _resolve_model_candidates(payload)

    if not model_candidates:
        return adapter.run_responses(payload)

    last_error: Exception | None = None
    total_attempts = 0

    for model_index, model in enumerate(model_candidates):
        request_payload = _build_payload_for_model(payload, model)
        attempts_for_model = retry_max_attempts if retry_enabled else 1

        for attempt in range(attempts_for_model):
            total_attempts += 1
            try:
                response = adapter.run_responses(request_payload)
                _set_execution_metadata(
                    payload,
                    selected_model=model,
                    attempts=total_attempts,
                    fallback_used=model_index > 0,
                )
                return response
            except Exception as error:
                last_error = error

                is_last_attempt = attempt >= attempts_for_model - 1
                has_next_model = model_index < len(model_candidates) - 1

                if not is_last_attempt:
                    if not _is_retryable_error(error):
                        break
                    if retry_backoff_ms > 0:
                        time.sleep((retry_backoff_ms * (2**attempt)) / 1000.0)
                    continue

                if has_next_model:
                    break

    if last_error is not None:
        _set_execution_metadata(
            payload,
            selected_model=model_candidates[-1] if model_candidates else None,
            attempts=total_attempts if total_attempts > 0 else 1,
            fallback_used=len(model_candidates) > 1,
        )
        raise last_error

    return adapter.run_responses(payload)


def resolve_litellm_responses_fn() -> Any:
    """Return the Responses callable exposed by the selected gateway adapter."""
    return get_gateway_adapter().resolve_responses_fn()


def _parse_allowed_models() -> set[str]:
    """Return configured allow-list for requested models.

    Empty set means allow all models.
    """
    raw = os.getenv("LITELLM_ALLOWED_MODELS", "")
    if not raw.strip():
        return set()
    return {item.strip() for item in raw.split(",") if item.strip()}


def _enforce_allowed_model(payload: dict[str, Any]) -> None:
    """Reject models that are not explicitly allowed by configuration."""
    allowed_models = _parse_allowed_models()
    if not allowed_models:
        return

    model = payload.get("model")
    if not isinstance(model, str) or not model.strip():
        raise PayloadValidationError(400, "Model is required when allow-list is enabled")

    requested_model = model.strip()
    if requested_model in allowed_models:
        return

    raise PayloadValidationError(400, f"Model '{requested_model}' is not allowed")


def _extract_provider_from_model(model: str | None) -> str | None:
    """Extract provider prefix from model string in the form provider/model."""
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


def extract_bearer_token_from_auth_header(auth_header: str | None) -> str | None:
    """Return raw bearer token from an Authorization header when present."""
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


def _env_flag(name: str, default: str = "false") -> bool:
    """Parse common boolean-like env values using a single rule."""
    value = os.getenv(name, default).strip().lower()
    return value in {"1", "true", "yes", "on"}


def _env_int(name: str, default: int, min_value: int = 0, max_value: int = 1_000_000) -> int:
    """Parse bounded integer values from env with safe fallback behavior."""
    raw = os.getenv(name)
    if raw is None:
        return default
    try:
        parsed = int(raw)
    except (TypeError, ValueError):
        return default

    if parsed < min_value:
        return min_value
    if parsed > max_value:
        return max_value
    return parsed


def _parse_fallback_models() -> list[str]:
    """Return configured fallback model chain as provider/model values."""
    raw = os.getenv("LITELLM_FALLBACK_MODELS", "")
    if not raw.strip():
        return []

    models: list[str] = []
    seen: set[str] = set()
    for item in raw.split(","):
        model = item.strip()
        if not model or model in seen:
            continue
        seen.add(model)
        models.append(model)
    return models


def _resolve_model_candidates(payload: dict[str, Any]) -> list[str]:
    """Return ordered model candidates: primary request model then configured fallbacks."""
    current_model = payload.get("model")
    primary = current_model.strip() if isinstance(current_model, str) else ""
    candidates: list[str] = []
    seen: set[str] = set()

    for model in [primary, *_parse_fallback_models()]:
        if not model or model in seen:
            continue
        seen.add(model)
        candidates.append(model)

    return candidates


def _is_retryable_error(error: Exception) -> bool:
    """Best-effort retry classification for transient provider and transport failures."""
    message = str(error).lower()
    name = error.__class__.__name__.lower()
    retry_tokens = (
        "timeout",
        "temporar",
        "rate limit",
        "429",
        "503",
        "connection",
        "network",
        "service unavailable",
        "too many requests",
    )

    if any(token in message for token in retry_tokens):
        return True

    return any(token in name for token in ("timeout", "connection", "temporar"))


def _build_payload_for_model(payload: dict[str, Any], model: str) -> dict[str, Any]:
    """Clone request payload while overriding the model for fallback attempts."""
    cloned = dict(payload)
    cloned["model"] = model
    return cloned


def _set_execution_metadata(
    payload: dict[str, Any],
    *,
    selected_model: str | None,
    attempts: int,
    fallback_used: bool,
) -> None:
    """Persist runtime execution details for route-level logging and response shaping."""
    metadata = payload.get("metadata")
    if not isinstance(metadata, dict):
        metadata = {}
        payload["metadata"] = metadata

    metadata["litellm_proxy_execution"] = {
        "selected_model": selected_model,
        "attempts": max(int(attempts), 1),
        "fallback_used": bool(fallback_used),
    }


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


def get_litellm_policy_summary() -> dict[str, Any]:
    """Return embedded LiteLLM policy toggles used by the Playground proxy path."""
    gateway_mode = os.getenv("LITELLM_GATEWAY_MODE", "embedded").strip().lower() or "embedded"
    fallback_models = _parse_fallback_models()
    return {
        "gateway_mode": gateway_mode,
        "allow_model_list_enabled": len(_parse_allowed_models()) > 0,
        "json_logs_enabled": _env_flag("LITELLM_JSON_LOGS", "true"),
        "inject_mcp_transport": inject_mcp_transport_enabled(),
        "retry_enabled": _env_flag("LITELLM_ENABLE_RETRY", "false"),
        "retry_max_attempts": _env_int("LITELLM_RETRY_MAX_ATTEMPTS", default=1, min_value=1, max_value=10),
        "retry_backoff_ms": _env_int("LITELLM_RETRY_BACKOFF_MS", default=250, min_value=0, max_value=30_000),
        "fallback_enabled": len(fallback_models) > 0,
        "fallback_models_count": len(fallback_models),
        "metrics_enabled": _env_flag("LITELLM_ENABLE_METRICS", "false"),
        "guardrails_enabled": _env_flag("LITELLM_ENABLE_GUARDRAILS", "false"),
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
    # Intentionally explicit no-op to keep function signature symmetrical.
    _ = payload
    _ = inbound_bearer_token


PROVIDER_DEFAULT_HANDLERS: dict[str, ProviderDefaultsHandler] = {
    "anthropic": _apply_noop_provider_defaults,
    "azure": _apply_azure_defaults,
    "openai": _apply_noop_provider_defaults,
    "vertex_ai": _apply_noop_provider_defaults,
}


def _apply_provider_defaults(payload: dict[str, Any], inbound_bearer_token: str | None = None) -> None:
    """Dispatch provider-specific defaulting based on resolved model prefix."""
    provider = _extract_provider_from_model(payload.get("model"))
    if not provider:
        return

    handler = PROVIDER_DEFAULT_HANDLERS.get(provider)
    if handler is None:
        return
    handler(payload, inbound_bearer_token)


def build_litellm_payload(
    payload: Any,
    req_id: str,
    user_oid: str,
    inbound_bearer_token: str | None = None,
) -> dict[str, Any]:
    """Build validated request payload with metadata and provider defaults."""
    if not isinstance(payload, dict):
        raise PayloadValidationError(400, "Expected JSON request body")

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
        raise PayloadValidationError(500, "LiteLLM model missing: provide request model or set LITELLM_DEFAULT_MODEL")

    _enforce_allowed_model(payload)

    _apply_provider_defaults(payload, inbound_bearer_token=inbound_bearer_token)

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


def resolve_requested_model(payload: dict[str, Any]) -> str | None:
    """Best-effort extraction of requested model from a prepared payload."""
    model = payload.get("model")
    if isinstance(model, str) and model.strip():
        return model.strip()
    return None
