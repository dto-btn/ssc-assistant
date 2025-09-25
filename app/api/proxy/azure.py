import logging
import os
import uuid

from apiflask import APIBlueprint
import requests

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, abort, request, stream_with_context

from proxy.common import PROXY_TIMEOUT, upstream_headers, stream_response

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

ROOT_PATH_PROXY_AZURE = "/proxy/azure"

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")

#service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
#key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

proxy_azure = APIBlueprint("proxy_azure", __name__)

@proxy_azure.post("<path:subpath>")
def openai_chat_completions(subpath: str):
    """
    OpenAI-compatible chat completions endpoint.

    This endpoint accepts requests in the OpenAI API format and proxies them to Azure OpenAI.
    It allows the frontend to use the OpenAI SDK with a custom base URL pointing to this route.
    """
    # Generate a request id to correlate logs across client/proxy/upstream
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())

    # Only forward to AOAI endpoint, never anywhere else
    upstream_url = f"{azure_openai_uri}/openai/{subpath}"

    # Basic logging (avoid logging full prompt content by default)
    user = request.headers.get("x-user-id") or "anon"
    logger.info("AOAI proxy start req_id=%s user=%s method=%s path=%s qs=%s",
                req_id, user, request.method, upstream_url, request.query_string.decode("utf-8"))

    try:
        token = token_provider()
        if not token:
            abort(500, "Server missing token provider")
        headers = upstream_headers(request.headers, f"Bearer {token}")

        # Note: requests will stream the body to AOAI as-is
        data = request.get_data() if request.method != "GET" else None

        def generate():
            with requests.request(
                request.method,
                upstream_url,
                params=request.args.to_dict(flat=False),
                headers=headers,
                data=data,
                stream=True,
                timeout=PROXY_TIMEOUT,
            ) as r:
                # Log key metadata
                logger.info("AOAI proxy upstream resp req_id=%s status=%s x-request-id=%s",
                            req_id, r.status_code, r.headers.get("x-request-id"))

                # Pass upstream headers/content back to client
                yield from stream_response(r)

        # Pass upstream headers/content back to client
        return Response(
            stream_with_context(generate()),
            headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            direct_passthrough=True,
        )

    except requests.Timeout:
        logger.exception("AOAI proxy timeout req_id=%s", req_id)
        return Response("Upstream timeout", status=504)
    except Exception:
        logger.exception("AOAI proxy error req_id=%s", req_id)
        return Response("Proxy error", status=502)
