from flask import request, jsonify
import base64
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Tuple
import logging
from urllib.parse import urlparse
from werkzeug.utils import secure_filename

from utils.auth import verify_user_access_token
from utils.azure_clients import get_blob_service_client
from utils.file_manager import FileManager
from apiflask import APIBlueprint
from azure.core.exceptions import AzureError, ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import ContentSettings, BlobClient, ContainerClient
import requests
from requests import RequestException

api_playground = APIBlueprint("api_playground", __name__)
logger = logging.getLogger(__name__)

CONTAINER_NAME = "assistant-chat-files-v2"


class PlaygroundAPIError(Exception):
    """Raised for controlled error responses."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def _get_authenticated_oid() -> str:
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise PlaygroundAPIError("Missing or invalid Authorization header", 401)
    access_token = auth_header.split(" ", 1)[1].strip()
    if not access_token:
        raise PlaygroundAPIError("Missing or invalid Authorization header", 401)

    user = verify_user_access_token(access_token)
    if not user or not getattr(user, "token", None):
        raise PlaygroundAPIError("Invalid access token", 401)

    payload = user.token
    oid = payload.get("oid") if isinstance(payload, dict) else None
    if not oid:
        raise PlaygroundAPIError("OID not found in token", 401)
    return oid


def _get_container_client() -> ContainerClient:
    client = get_blob_service_client()
    return client.get_container_client(CONTAINER_NAME)


def _sanitize_blob_name(blob_name: str) -> Optional[str]:
    if not blob_name:
        return None
    cleaned = blob_name.strip().lstrip("/").rstrip("/")
    if not cleaned or ".." in cleaned.split("/") or "\\" in cleaned:
        return None
    return cleaned


def _blob_name_from_url(file_url: str, container_client: ContainerClient) -> Optional[str]:
    try:
        parsed = urlparse(file_url)
    except ValueError:
        return None

    container_parsed = urlparse(container_client.url)
    if (parsed.scheme, parsed.netloc) != (container_parsed.scheme, container_parsed.netloc):
        return None

    container_path = container_parsed.path.rstrip("/")
    request_path = parsed.path
    if not request_path.startswith(container_path + "/"):
        return None

    relative_path = request_path[len(container_path) + 1 :]
    return _sanitize_blob_name(relative_path)


def _get_blob_client_for_request(
    file_url: Optional[str],
    blob_name: Optional[str],
    oid: str,
    container_client: ContainerClient,
) -> Optional[BlobClient]:
    candidate = blob_name
    if candidate:
        candidate = _sanitize_blob_name(candidate)
    elif file_url:
        candidate = _blob_name_from_url(file_url, container_client)

    if not candidate or not candidate.startswith(f"{oid}/"):
        return None

    return container_client.get_blob_client(candidate)


def _resolve_optional_oid() -> Tuple[Optional[str], Optional[PlaygroundAPIError]]:
    try:
        return _get_authenticated_oid(), None
    except PlaygroundAPIError as exc:
        return None, exc


def _fetch_file_bytes(
    file_url: Optional[str],
    blob_name: Optional[str],
    requested_type: Optional[str],
    oid: Optional[str],
    auth_error: Optional[PlaygroundAPIError],
) -> Tuple[bytes, str]:
    container_client = _get_container_client()

    if oid:
        blob_client = _get_blob_client_for_request(file_url, blob_name, oid, container_client)
        if not blob_client:
            raise PlaygroundAPIError("File not found", 404)
        try:
            props = blob_client.get_blob_properties()
            file_bytes = blob_client.download_blob(max_concurrency=1).readall()
        except ResourceNotFoundError as exc:
            raise PlaygroundAPIError("File not found", 404) from exc
        except AzureError as exc:
            logger.exception("Failed to fetch blob for oid %s", oid)
            raise PlaygroundAPIError("Failed to fetch file", 500) from exc

        content_type = (
            requested_type
            or getattr(getattr(props, "content_settings", None), "content_type", None)
            or ""
        )
        return file_bytes, content_type

    if not file_url:
        if auth_error:
            raise auth_error
        raise PlaygroundAPIError("File not found", 404)

    if not _blob_name_from_url(file_url, container_client):
        raise PlaygroundAPIError("File not found", 404)

    try:
        resp = requests.get(file_url, timeout=10)
        resp.raise_for_status()
    except RequestException as exc:
        logger.exception("Failed to download file via HTTP")
        raise PlaygroundAPIError("Failed to fetch file", 500) from exc

    content_type = requested_type or resp.headers.get("Content-Type") or "application/octet-stream"
    return resp.content, content_type

# GET /api/playground/files-for-session: Returns files for a given sessionId by searching blob metadata
@api_playground.route("/files-for-session", methods=["GET"])
def files_for_session():
    """Return metadata for the caller's files bound to a session.

    The bearer token identifies the caller via `oid`, which scopes the blob
    search to their personal prefix. Results are filtered by the provided
    `sessionId` query string parameter and returned as JSON.
    """
    session_id = request.args.get("sessionId")
    if not session_id:
        return jsonify({"message": "sessionId is required"}), 400

    try:
        oid = _get_authenticated_oid()
    except PlaygroundAPIError as exc:
        return jsonify({"message": str(exc)}), exc.status_code

    try:
        container_client = _get_container_client()
        blob_list = container_client.list_blobs(name_starts_with=f"{oid}/", include=["metadata"])
        files = []
        for blob in blob_list:
            meta = getattr(blob, "metadata", {}) or {}
            if meta.get("sessionid") != session_id:
                continue
            content_type = None
            content_settings = getattr(blob, "content_settings", None)
            if content_settings:
                content_type = getattr(content_settings, "content_type", None)
            files.append(
                {
                    "name": blob.name,
                    "url": f"{container_client.url}/{blob.name}",
                    "size": getattr(blob, "size", None),
                    "contentType": content_type,
                    "originalName": meta.get("originalname"),
                    "uploadedAt": meta.get("uploadedat"),
                    "sessionId": meta.get("sessionid"),
                    "category": meta.get("category"),
                }
            )
        return jsonify({"files": files})
    except ResourceNotFoundError:
        return jsonify({"files": []})
    except AzureError:
        logger.exception("Failed to list files for session %s", session_id)
        return jsonify({"message": "Failed to list files"}), 500


# POST /api/1.0/upload: Accepts encoded_file, name, and access token, uploads to Azure Blob Storage with user_id metadata
@api_playground.route("/upload", methods=["POST"])
def upload_file():
    """Persist a base64 encoded file in blob storage for the signed-in user.

    The request body must include `encoded_file` and `name`, plus optional
    `sessionId`, `category`, `fileType`, and arbitrary metadata. The function
    derives a per-user blob path, uploads the decoded bytes, and returns a
    summary payload describing the stored file.
    """
    data: Dict[str, Any] = request.get_json() or {}
    encoded_file = data.get("encoded_file")
    original_name = data.get("name")
    session_id = data.get("sessionId") or data.get("session_id")
    category = (data.get("category") or "files").lower()
    mime_type = data.get("fileType") or data.get("mimeType") or data.get("type")
    metadata_input = data.get("metadata")
    extra_metadata: Dict[str, Any] = metadata_input if isinstance(metadata_input, dict) else {}

    if not encoded_file or not original_name:
        return jsonify({"message": "encoded_file and name are required"}), 400

    try:
        oid = _get_authenticated_oid()
    except PlaygroundAPIError as exc:
        return jsonify({"message": str(exc)}), exc.status_code

    normalized_name = secure_filename(original_name)
    if not normalized_name:
        return jsonify({"message": "Invalid file name"}), 400

    encoded_payload = encoded_file
    if encoded_payload.startswith("data:"):
        encoded_payload = encoded_payload.split(",", 1)[-1]
    try:
        file_bytes = base64.b64decode(encoded_payload)
    except Exception:
        return jsonify({"message": "Failed to decode file"}), 400

    # Build blob path
    safe_category = "chat" if category not in {"files", "chat"} else category
    session_segment = f"{session_id}/" if session_id else ""
    blob_name = f"{oid}/{safe_category}/{session_segment}{uuid.uuid4().hex}_{normalized_name}"

    uploaded_at = datetime.utcnow().isoformat() + "Z"
    metadata = {
        "user_id": oid,
        "originalname": original_name,
        "uploadedat": uploaded_at,
        "category": safe_category,
    }
    if session_id:
        metadata["sessionid"] = str(session_id)
    if mime_type:
        metadata["mimetype"] = mime_type
    for key, value in extra_metadata.items():
        if value is None:
            continue
        metadata[str(key).lower()] = str(value)

    try:
        container_client = _get_container_client()
    except AzureError:
        logger.exception("Failed to access blob service for oid %s", oid)
        return jsonify({"message": "Upload failed"}), 500

    try:
        container_client.create_container()
    except ResourceExistsError:
        pass
    except AzureError:
        logger.exception("Failed to ensure container exists for oid %s", oid)
        return jsonify({"message": "Upload failed"}), 500

    try:
        blob_client = container_client.get_blob_client(blob_name)
        content_settings = ContentSettings(content_type=mime_type) if mime_type else None
        blob_client.upload_blob(
            file_bytes,
            overwrite=True,
            metadata=metadata,
            content_settings=content_settings,
        )
        blob_url = blob_client.url
    except AzureError:
        logger.exception("Failed to upload blob for oid %s", oid)
        return jsonify({"message": "Upload failed"}), 500

    file_payload = {
        "blobName": blob_name,
        "url": blob_url,
        "originalName": original_name,
        "uploadedAt": uploaded_at,
        "sessionId": session_id,
        "category": safe_category,
        "size": len(file_bytes),
        "contentType": mime_type,
    }
    return jsonify({"file": file_payload, "message": "Uploaded"})

# POST /api/playground/extract-file-text: Accepts fileUrl and fileType, returns extracted text
@api_playground.route("/extract-file-text", methods=["POST"])
def extract_file_text():
    """Fetch a remote file and extract plain text using the FileManager helper.

    The JSON body must include `fileUrl`, with an optional `fileType` hint. The
    endpoint streams the file into memory, invokes `FileManager.extract_text`,
    and responds with the extracted text or an error message.
    """
    data = request.get_json() or {}
    file_url = data.get("fileUrl")
    blob_name = data.get("blobName")
    requested_type = data.get("fileType")
    if not file_url and not blob_name:
        return jsonify({"error": "fileUrl or blobName is required"}), 400

    oid, auth_error = _resolve_optional_oid()
    try:
        file_bytes, resolved_type = _fetch_file_bytes(
            file_url,
            blob_name,
            requested_type,
            oid,
            auth_error,
        )
    except PlaygroundAPIError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    try:
        fm = FileManager(file_bytes, resolved_type)
        text = fm.extract_text()
    except Exception:
        logger.exception(
            "Failed to extract text for resource", extra={"blob_name": blob_name, "file_url": file_url}
        )
        return jsonify({"error": "Failed to extract text"}), 500

    return jsonify({"extractedText": text})

# POST /api/playground/file-data-url: Accepts fileUrl and optional fileType, returns base64 data URL
@api_playground.route("/file-data-url", methods=["POST"])
def file_data_url():
    """Return a data URL for the file located at the supplied `fileUrl`.

    Accepts an optional `fileType` to override the detected content type.
    The response encodes the remote file as a base64 `data:` URL alongside the
    content type so the client can embed or preview the asset directly.
    """
    data = request.get_json() or {}
    file_url = data.get("fileUrl")
    blob_name = data.get("blobName")
    requested_type = data.get("fileType")
    if not file_url and not blob_name:
        return jsonify({"error": "fileUrl or blobName is required"}), 400

    oid, auth_error = _resolve_optional_oid()
    try:
        file_bytes, content_type = _fetch_file_bytes(
            file_url,
            blob_name,
            requested_type,
            oid,
            auth_error,
        )
    except PlaygroundAPIError as exc:
        return jsonify({"error": str(exc)}), exc.status_code

    if not content_type:
        content_type = "application/octet-stream"
    encoded = base64.b64encode(file_bytes).decode("utf-8")
    data_url = f"data:{content_type};base64,{encoded}"
    return jsonify({"dataUrl": data_url, "contentType": content_type})