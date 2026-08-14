"""Server-side blob streaming so previews go through the API (managed identity), not a SAS URL.

The frontend host used to proxy blob previews straight to storage with a long-lived SAS
token. These reads now flow through the API, which streams blobs using its managed identity.
Requests carry only the API key (image tags cannot send a bearer token); the frontend host
injects it, so the endpoint is protected the same way as the previous same-origin proxy.
"""

import logging

from apiflask import APIBlueprint
from flask import Response, abort
from azure.core.exceptions import AzureError, ResourceNotFoundError

from utils.auth import auth
from utils.azure_clients import get_blob_service_client

logger = logging.getLogger(__name__)

api_playground_blob = APIBlueprint("api_playground_blob", __name__, tag="Playground")

# Containers whose blobs the playground may stream to the browser.
_ALLOWED_BLOB_CONTAINERS = {
    "assistant-chat-files",
    "assistant-chat-files-v2",
    "pmcoe-dev",
    "pmcoe-sept-2025",
    "pmcoe-latest",
}


def _safe_blob_name(blob_name: str) -> str | None:
    """Reject path traversal and empty names before hitting storage."""
    cleaned = (blob_name or "").strip().lstrip("/")
    if not cleaned or "\\" in cleaned or ".." in cleaned.split("/"):
        return None
    return cleaned


@api_playground_blob.get("/blob/<container>/<path:blob_name>")
@auth.login_required(role="chat")
def get_blob(container: str, blob_name: str):
    """Stream a blob from an allow-listed container via the API's managed identity."""
    if container not in _ALLOWED_BLOB_CONTAINERS:
        abort(404)

    safe_name = _safe_blob_name(blob_name)
    if not safe_name:
        abort(404)

    blob_client = get_blob_service_client().get_container_client(container).get_blob_client(safe_name)
    try:
        downloader = blob_client.download_blob(max_concurrency=1)
        data = downloader.readall()
        content_type = getattr(getattr(downloader, "properties", None), "content_settings", None)
    except ResourceNotFoundError:
        abort(404)
    except AzureError:
        logger.exception("Failed to stream blob %s/%s", container, safe_name)
        abort(502)

    resolved_type = getattr(content_type, "content_type", None) or "application/octet-stream"
    return Response(
        data,
        status=200,
        content_type=resolved_type,
        headers={"Cache-Control": "private, max-age=300"},
    )
