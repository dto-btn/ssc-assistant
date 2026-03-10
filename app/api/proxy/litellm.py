import logging
import os
import time
import uuid

from apiflask import APIBlueprint
import requests
from flask import Response, abort, request, stream_with_context, g

from utils.auth import user_ad
from proxy.common import PROXY_TIMEOUT, upstream_headers, stream_response

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

ROOT_PATH_PROXY_LITELLM = "/proxy/litellm"

proxy_litellm = APIBlueprint("proxy_litellm", __name__)


def _normalize_litellm_url(raw_url: str | None) -> str | None:
    if not raw_url:
        return None
    trimmed = raw_url.strip()
    if not trimmed:
        return None
    return trimmed.rstrip("/")


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
    """Simple health endpoint to validate that LiteLLM proxy settings exist."""
    litellm_base_url = _normalize_litellm_url(os.getenv("LITELLM_PROXY_URL"))
    if not litellm_base_url:
        return {"status": "unhealthy", "reason": "LITELLM_PROXY_URL missing"}, 503
    return {
        "status": "ok",
        "upstream": litellm_base_url,
        "has_api_key": bool(os.getenv("LITELLM_PROXY_API_KEY", "").strip()),
    }, 200


@proxy_litellm.post("<path:subpath>")
@user_ad.login_required
def litellm_proxy(subpath: str):
    """OpenAI-compatible proxy endpoint for LiteLLM.

    This endpoint is intended for the Playground flow so browser clients can
    call a same-origin backend route, while the backend forwards to LiteLLM.
    """
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    start_time = time.perf_counter()

    litellm_base_url = _normalize_litellm_url(os.getenv("LITELLM_PROXY_URL"))
    if not litellm_base_url:
        logger.error("LiteLLM proxy missing configuration req_id=%s", req_id)
        abort(500, "Server missing LITELLM_PROXY_URL")

    upstream_url = f"{litellm_base_url}/{subpath.lstrip('/')}"
    requested_model = _extract_request_model()

    user_token = g.user.token if hasattr(g, "user") and g.user and g.user.token else None
    user_oid = user_token.get("oid") if isinstance(user_token, dict) else "anon"

    logger.info(
        "LiteLLM proxy start req_id=%s user=%s method=%s path=%s qs=%s model=%s",
        req_id,
        user_oid,
        request.method,
        upstream_url,
        request.query_string.decode("utf-8"),
        requested_model or "unknown",
    )

    try:
        litellm_api_key = os.getenv("LITELLM_PROXY_API_KEY", "").strip()
        auth_header = f"Bearer {litellm_api_key}" if litellm_api_key else None
        headers = upstream_headers(request.headers, auth_header)
        headers["x-request-id"] = req_id
        headers["x-user-oid"] = str(user_oid)

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
            ) as response:
                logger.info(
                    "LiteLLM proxy upstream resp req_id=%s status=%s latency_ms=%.1f model=%s",
                    req_id,
                    response.status_code,
                    (time.perf_counter() - start_time) * 1000,
                    requested_model or "unknown",
                )
                yield from stream_response(response)

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
        logger.exception(
            "LiteLLM proxy timeout req_id=%s latency_ms=%.1f model=%s",
            req_id,
            (time.perf_counter() - start_time) * 1000,
            requested_model or "unknown",
        )
        return Response("Upstream timeout", status=504)
    except Exception:
        logger.exception(
            "LiteLLM proxy error req_id=%s latency_ms=%.1f model=%s",
            req_id,
            (time.perf_counter() - start_time) * 1000,
            requested_model or "unknown",
        )
        return Response("Proxy error", status=502)
