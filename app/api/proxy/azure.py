import logging
import os
import uuid

from apiflask import APIBlueprint
import requests
import json

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
    """
    # Generate a request id to correlate logs across client/proxy/upstream
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())

    # Ensure endpoint is configured
    if not azure_openai_uri:
        logger.error("AOAI proxy missing AZURE_OPENAI_ENDPOINT configuration req_id=%s", req_id)
        return Response("Server misconfiguration: AZURE_OPENAI_ENDPOINT is not set", status=500)

    # Read raw body early so we can inspect JSON without consuming the stream later
    raw_body = request.get_data() if request.method != "GET" else None

    # Try to parse JSON body to discover a deployment/model name. We prefer an explicit
    # 'deployment' field, then 'model'. If neither is present, fall back to the
    # AZURE_OPENAI_MODEL environment variable set by infra (terraform). If still
    # missing, fail early with a clear error so the caller can correct the request.
    body_json = {}
    if raw_body:
        try:
            body_json = json.loads(raw_body)
        except Exception:
            body_json = {}

    # Diagnostic: record whether the incoming request asked for streaming and the requested model
    try:
        requested_stream = bool(body_json.get("stream"))
        requested_model = body_json.get("model")
        logger.debug("AOAI proxy incoming request model=%s stream=%s req_id=%s", requested_model, requested_stream, req_id)
    except Exception:
        # never fail on logging
        pass

    deployment = (
        body_json.get("deployment")
        or body_json.get("model")
        or os.getenv("AZURE_OPENAI_MODEL")
    )

    if not deployment:
        logger.error("AOAI proxy missing deployment/model in request and AZURE_OPENAI_MODEL not set req_id=%s", req_id)
        return Response("Missing 'deployment' or 'model' in request body and no AZURE_OPENAI_MODEL configured on the server", status=400)

    # Build the deployments-style upstream URL expected by Azure OpenAI
    # e.g. https://<endpoint>/openai/deployments/{deployment}/chat/completions
    upstream_url = f"{azure_openai_uri}/openai/deployments/{deployment}/{subpath}"

    # Resolve API version to ensure Azure OpenAI receives the required api-version
    # query parameter when callers (e.g. browser SDK) don't include it. Prefer
    # OPENAI_API_VERSION (used by the OpenAI SDK) and fall back to
    # AZURE_OPENAI_VERSION (set by our Terraform infra) if present.
    api_version_env = os.getenv("OPENAI_API_VERSION") or os.getenv("AZURE_OPENAI_VERSION") or "2024-05-01-preview"
    logger.debug("AOAI proxy resolved deployment=%s api_version=%s req_id=%s", deployment, api_version_env, req_id)

    # Basic logging (avoid logging full prompt content by default)
    # Get user ID from the authenticated Azure AD token (OID claim)
    user_token = g.user.token if hasattr(g, 'user') and g.user and g.user.token else None
    user = user_token.get('oid') if user_token else "anon"
    logger.info("AOAI proxy start req_id=%s user=%s method=%s path=%s qs=%s",
                req_id, user, request.method, upstream_url, request.query_string.decode("utf-8"))

    try:
        try:
            token = token_provider()
        except Exception:
            logger.exception("Failed to acquire bearer token from DefaultAzureCredential req_id=%s", req_id)
            abort(500, "Server failed to acquire token for upstream request")

        if not token:
            abort(500, "Server missing token provider")

        # token_provider may return an AccessToken-like object; extract the token string
        token_value = getattr(token, "token", None) or str(token)
        headers = upstream_headers(request.headers, f"Bearer {token_value}")

        # Note: requests will stream the body to AOAI as-is
        data = request.get_data() if request.method != "GET" else None

        # Build request params starting from the incoming query string. If the
        # client didn't provide an Azure `api-version` query param, inject the
        # environment-configured one so Azure routes the call correctly.
        params = request.args.to_dict(flat=False)
        if api_version_env:
            # check case-insensitively for api-version
            has_api_version = any(k.lower() == "api-version" for k in params.keys())
            if not has_api_version:
                params["api-version"] = api_version_env

        # Perform the upstream request (stream=True) so we can capture status and headers
        r = requests.request(
            request.method,
            upstream_url,
            params=params,
            headers=headers,
            data=data,
            stream=True,
            timeout=PROXY_TIMEOUT,
        )

        # Log key metadata and diagnostic headers to help debug streaming behaviour
        content_type = r.headers.get("Content-Type") or r.headers.get("content-type")
        transfer_encoding = r.headers.get("Transfer-Encoding") or r.headers.get("transfer-encoding")
        content_length = r.headers.get("Content-Length") or r.headers.get("content-length")

        logger.info(
            "AOAI proxy upstream resp req_id=%s status=%s x-request-id=%s content-type=%s transfer-encoding=%s content-length=%s",
            req_id,
            r.status_code,
            r.headers.get("x-request-id"),
            content_type,
            transfer_encoding,
            content_length,
        )

        # Warn if the upstream response doesn't look like a stream (e.g., missing
        # event-stream or chunked encoding) which can result in the UI seeing no deltas
        if r.status_code == 200:
            if content_type and "event-stream" not in content_type.lower() and not transfer_encoding:
                logger.warning("AOAI upstream response looks non-streaming (status=200) req_id=%s content-type=%s transfer-encoding=%s", req_id, content_type, transfer_encoding)

        def generate_from_r():
            try:
                yield from stream_response(r)
            finally:
                try:
                    r.close()
                except Exception:
                    pass

        # Build response headers based on upstream, filter hop-by-hop headers
        resp_headers = dict(filtered_response_headers(r))
        # Ensure SSE-friendly headers
        resp_headers.update({
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        })

        return Response(
            stream_with_context(generate_from_r()),
            status=r.status_code,
            headers=resp_headers,
            direct_passthrough=True,
        )

    except requests.Timeout:
        logger.exception("AOAI proxy timeout req_id=%s", req_id)
        return Response("Upstream timeout", status=504)
    except Exception:
        logger.exception("AOAI proxy error req_id=%s", req_id)
        return Response("Proxy error", status=502)
