"""Azure OpenAI reverse-proxy endpoints used by the playground.

Preserves OpenAI-compatible request/response semantics for the frontend SDK
while supporting orchestrated tool-routing flows.
"""

import logging
import os
import uuid

from apiflask import APIBlueprint
import requests

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, abort, request, stream_with_context, g

from utils.auth import user_ad
from proxy.common import PROXY_TIMEOUT, upstream_headers, stream_response, filtered_response_headers

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

ROOT_PATH_PROXY_AZURE = "/proxy/azure"

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")

proxy_azure = APIBlueprint("proxy_azure", __name__)

@proxy_azure.post("<path:subpath>")
@user_ad.login_required
def openai_chat_completions(subpath: str):
    """
    OpenAI-compatible chat completions endpoint.

    This endpoint accepts requests in the OpenAI API format and proxies them to Azure OpenAI.
    It allows the frontend to use the OpenAI SDK with a custom base URL pointing to this route.

        Implementation notes:
        - Preserves streaming semantics by forwarding chunked upstream responses.
        - Injects Entra ID bearer token generated with `DefaultAzureCredential`.
        - Returns upstream status/body as-is for non-2xx responses to avoid masking
            Azure OpenAI error diagnostics.
    """
    # Generate a request id to correlate logs across client/proxy/upstream
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())

    # Only forward to AOAI endpoint, never anywhere else
    upstream_url = f"{azure_openai_uri}/openai/{subpath}"

    # Basic logging (avoid logging full prompt content by default)
    # Get user ID from the authenticated Azure AD token (OID claim)
    user_token = g.user.token if hasattr(g, 'user') and g.user and g.user.token else None
    user = user_token.get('oid') if user_token else "anon"
    logger.info("AOAI proxy start req_id=%s user=%s method=%s path=%s qs=%s",
                req_id, user, request.method, upstream_url, request.query_string.decode("utf-8"))

    try:
        token = token_provider()
        if not token:
            abort(500, "Server missing token provider")
        headers = upstream_headers(request.headers, f"Bearer {token}")

        # Note: requests will stream the body to AOAI as-is
        data = request.get_data() if request.method != "GET" else None

        upstream_response = requests.request(
            request.method,
            upstream_url,
            params=request.args.to_dict(flat=False),
            headers=headers,
            data=data,
            stream=True,
            timeout=PROXY_TIMEOUT,
        )

        logger.info(
            "AOAI proxy upstream resp req_id=%s status=%s x-request-id=%s content-type=%s",
            req_id,
            upstream_response.status_code,
            upstream_response.headers.get("x-request-id"),
            upstream_response.headers.get("content-type"),
        )

        response_headers = dict(filtered_response_headers(upstream_response))
        response_headers["X-Request-Id"] = req_id

        # Surface upstream error payload directly (JSON/text) for client diagnostics.
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
                # Relay upstream chunks without buffering to preserve token streaming UX.
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

    except requests.Timeout:
        logger.exception("AOAI proxy timeout req_id=%s", req_id)
        return Response("Upstream timeout", status=504)
    except Exception:
        logger.exception("AOAI proxy error req_id=%s", req_id)
        return Response("Proxy error", status=502)
