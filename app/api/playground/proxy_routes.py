"""Server-side proxy routes so the browser never talks to LiteLLM or the orchestrator directly.

The frontend calls these same-origin `/api/playground/*` endpoints with the user's AAD
token; this layer authenticates the user and then injects the server-held credentials
(LiteLLM master key on `X-Litellm-Key`, plus a managed-identity token for Easy Auth) before
forwarding upstream. The master key is therefore never exposed to end users.
"""

import json
import logging
import os
import uuid

from apiflask import APIBlueprint
import requests

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, abort, jsonify, request, stream_with_context

from utils.auth import auth, user_ad
from proxy.common import PROXY_TIMEOUT, upstream_headers, stream_response, filtered_response_headers
from playground import mcp_registry

logger = logging.getLogger(__name__)

api_playground_proxy = APIBlueprint("api_playground_proxy", __name__, tag="Playground")

# Base URLs are configured without a trailing slash; the request subpath is appended.
_LITELLM_PROXY_URL = (os.getenv("LITELLM_PROXY_URL", "http://localhost:4000") or "").rstrip("/")
_LITELLM_MASTER_KEY = os.getenv("LITELLM_MASTER_KEY", "")
_LITELLM_SCOPE = (os.getenv("LITELLM_SCOPE", "") or "").strip()

_ORCHESTRATOR_URL = (os.getenv("ORCHESTRATOR_URL", "http://localhost:8000") or "").rstrip("/")
_ORCHESTRATOR_SCOPE = (os.getenv("ORCHESTRATOR_SCOPE", "") or "").strip()

# Only these LiteLLM subpaths may be reached through the proxy; keeps it from being an
# open relay to admin routes such as /key/generate.
_ALLOWED_LITELLM_SUBPATHS = {"v1/responses", "v1/images/generations"}

# Never relay these upstream response headers back to the browser; they could carry
# credentials or set client-side state that the browser must not receive.
_RESPONSE_HEADER_DENYLIST = {"authorization", "x-litellm-key", "set-cookie", "www-authenticate"}

CALLER_SYSTEM = "ssc-assistant"
CALLER_COMPONENT = "ssc-assistant-playground"

# Managed-identity token providers are created lazily and only when a scope is configured
# (production Easy Auth). Local dev leaves the scope empty and skips this layer.
_litellm_token_provider = None
_orchestrator_token_provider = None


def _get_litellm_token_provider():
    global _litellm_token_provider  # pylint: disable=global-statement
    if _litellm_token_provider is None:
        _litellm_token_provider = get_bearer_token_provider(DefaultAzureCredential(), _LITELLM_SCOPE)
    return _litellm_token_provider


def _get_orchestrator_token_provider():
    global _orchestrator_token_provider  # pylint: disable=global-statement
    if _orchestrator_token_provider is None:
        _orchestrator_token_provider = get_bearer_token_provider(DefaultAzureCredential(), _ORCHESTRATOR_SCOPE)
    return _orchestrator_token_provider


def _caller_headers(incoming) -> dict:
    """Preserve caller-attribution headers used by LiteLLM analytics/spend tagging."""
    system = incoming.get("x-caller-system") or CALLER_SYSTEM
    component = incoming.get("x-caller-component") or CALLER_COMPONENT
    return {"x-caller-system": system, "x-caller-component": component}


def _prepare_litellm_body(subpath: str, raw_body: bytes) -> bytes:
    """Expand opaque MCP tool refs to real endpoints server-side for responses calls.

    Only the responses endpoint carries a `tools` array. On any parse failure the original
    body is forwarded unchanged so non-JSON or unexpected payloads still work.
    """
    if subpath != "v1/responses" or not raw_body:
        return raw_body
    try:
        body = json.loads(raw_body)
    except (ValueError, UnicodeDecodeError):
        return raw_body
    injected = mcp_registry.inject_mcp_tools(body)
    return json.dumps(injected).encode("utf-8")


@api_playground_proxy.get("/mcp-servers")
@auth.login_required(role="chat")
@user_ad.login_required
def list_mcp_servers():
    """Return the browser-safe MCP server catalog (ids/labels only, never URLs)."""
    return jsonify({"servers": mcp_registry.sanitized_servers()})


@api_playground_proxy.post("/litellm/<path:subpath>")
@auth.login_required(role="chat")
@user_ad.login_required
def litellm_proxy(subpath: str):
    """Stream a request to the standalone LiteLLM proxy, injecting the master key server-side."""
    if subpath not in _ALLOWED_LITELLM_SUBPATHS:
        abort(404, f"Unsupported LiteLLM subpath: {subpath}")

    if not _LITELLM_MASTER_KEY:
        logger.error("LITELLM_MASTER_KEY is not configured; cannot proxy to LiteLLM.")
        abort(500, "Server missing LiteLLM credentials")

    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    upstream_url = f"{_LITELLM_PROXY_URL}/{subpath}"

    # Start from the safe allow-listed passthrough headers, then inject server credentials.
    # Never forward the caller's Authorization or any client-supplied X-Litellm-Key.
    headers = upstream_headers(request.headers)
    headers.update(_caller_headers(request.headers))
    headers["X-Litellm-Key"] = f"Bearer {_LITELLM_MASTER_KEY}"
    if _LITELLM_SCOPE:
        headers["Authorization"] = f"Bearer {_get_litellm_token_provider()()}"

    outgoing_body = _prepare_litellm_body(subpath, request.get_data())

    try:
        upstream_response = requests.request(
            "POST",
            upstream_url,
            data=outgoing_body,
            headers=headers,
            stream=True,
            timeout=PROXY_TIMEOUT,
        )
    except requests.Timeout:
        logger.exception("LiteLLM proxy timeout req_id=%s", req_id)
        return Response("Upstream timeout", status=504)
    except requests.RequestException:
        logger.exception("LiteLLM proxy error req_id=%s", req_id)
        return Response("Proxy error", status=502)

    response_headers = {
        k: v
        for k, v in filtered_response_headers(upstream_response)
        if k.lower() not in _RESPONSE_HEADER_DENYLIST
    }
    response_headers["X-Request-Id"] = req_id

    if upstream_response.status_code >= 400:
        try:
            error_body = upstream_response.content
        finally:
            upstream_response.close()
        return Response(
            error_body,
            status=upstream_response.status_code,
            headers=response_headers,
            direct_passthrough=True,
        )

    def generate():
        try:
            yield from stream_response(upstream_response)
        finally:
            upstream_response.close()

    response_headers["Cache-Control"] = "no-cache"
    response_headers["Connection"] = "keep-alive"
    response_headers["X-Accel-Buffering"] = "no"

    return Response(
        stream_with_context(generate()),
        status=upstream_response.status_code,
        headers=response_headers,
        direct_passthrough=True,
    )


@api_playground_proxy.post("/orchestrator/suggest-route")
@auth.login_required(role="chat")
@user_ad.login_required
def orchestrator_suggest_route():
    """Relay a routing request to the orchestrator so the browser never contacts it directly."""
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    upstream_url = f"{_ORCHESTRATOR_URL}/orchestrator/suggest-route"

    headers = {"Content-Type": "application/json"}
    headers.update(_caller_headers(request.headers))
    if _ORCHESTRATOR_SCOPE:
        headers["Authorization"] = f"Bearer {_get_orchestrator_token_provider()()}"

    try:
        upstream_response = requests.post(
            upstream_url,
            data=request.get_data(),
            headers=headers,
            timeout=PROXY_TIMEOUT,
        )
    except requests.Timeout:
        logger.exception("Orchestrator proxy timeout req_id=%s", req_id)
        return jsonify({"error": {"code": "upstream_timeout", "message": "Orchestrator timeout"}}), 504
    except requests.RequestException:
        logger.exception("Orchestrator proxy error req_id=%s", req_id)
        return jsonify({"error": {"code": "upstream_unavailable", "message": "Orchestrator unavailable"}}), 502

    content_type = upstream_response.headers.get("content-type", "application/json")

    # Strip internal endpoint URLs from routing recommendations so the browser only ever
    # receives opaque server ids.
    if upstream_response.ok and "application/json" in content_type.lower():
        try:
            sanitized = mcp_registry.sanitize_route_response(upstream_response.json())
            return Response(json.dumps(sanitized), status=upstream_response.status_code,
                            content_type="application/json")
        except ValueError:
            pass

    return Response(
        upstream_response.content,
        status=upstream_response.status_code,
        content_type=content_type,
    )
