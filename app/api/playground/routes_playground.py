import base64
import uuid
from datetime import datetime
from typing import Dict, Any, Optional, Tuple, List, Type, TypeVar
import logging
from urllib.parse import urlparse
from werkzeug.utils import secure_filename
import mimetypes

from utils.auth import auth, user_ad
from utils.azure_clients import get_blob_service_client
from utils.file_manager import FileManager
from apiflask import APIBlueprint
from azure.core.exceptions import AzureError, ResourceExistsError, ResourceNotFoundError
from azure.storage.blob import ContentSettings, BlobClient, ContainerClient
from utils.models import (
    PlaygroundSessionFilesQuery,
    PlaygroundFilesResponse,
    PlaygroundUploadRequest,
    PlaygroundUploadResponse,
    PlaygroundExtractTextRequest,
    PlaygroundExtractTextResponse,
)

api_playground = APIBlueprint("api_playground", __name__, tag="Playground")
logger = logging.getLogger(__name__)

CONTAINER_NAME = "assistant-chat-files-v2"

# Align with main app's text extraction capabilities so behavior stays consistent.
SUPPORTED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "application/vnd.ms-word.document.macroenabled.12",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.ms-excel.sheet.macroenabled.12",
    "text/csv",
    "application/csv",
    "text/tab-separated-values",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "application/vnd.ms-powerpoint",
    "application/vnd.ms-powerpoint.presentation.macroenabled.12",
    "text/plain",
}

# Extension fallback helps when browsers omit MIME metadata or users rename files.
SUPPORTED_EXTENSIONS = {
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".tsv",
    ".txt",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".gif",
    ".bmp",
    ".webp",
    ".svg",
}

TEXT_MIME_PREFIX = "text/"
IMAGE_MIME_PREFIX = "image/"
DELETED_FLAG_VALUE = "true"


def _is_marked_deleted(metadata: Optional[Dict[str, Any]]) -> bool:
<<<<<<< HEAD
    """Return True when the blob metadata marks the file as soft-deleted."""
=======
>>>>>>> 7e322aa (Add remote session deletion handling and cover soft delete metadata)
    if not metadata:
        return False
    flag = metadata.get("deleted")
    if isinstance(flag, str):
        return flag.lower() == DELETED_FLAG_VALUE
    if isinstance(flag, bool):
        return flag
    return False


def _normalize_extension(filename: str) -> Optional[str]:
    """Extract and normalize the file extension so type checks remain consistent."""
    last_dot = filename.rfind(".")
    if last_dot == -1:
        return None
    return filename[last_dot:].lower()


# Keep attachment policy identical to the main app's extractor for `files` uploads.
def _is_supported_file(mime_type: Optional[str], filename: str, category: str) -> bool:
    """Validate whether a file is eligible for upload given its MIME or extension."""
    if category != "files":
        return True
    normalized_mime = (mime_type or "").lower()
    if normalized_mime:
        if (
            normalized_mime in SUPPORTED_MIME_TYPES
            or normalized_mime.startswith(TEXT_MIME_PREFIX)
            or normalized_mime.startswith(IMAGE_MIME_PREFIX)
        ):
            return True

    normalized_extension = _normalize_extension(filename)
    if normalized_extension and normalized_extension in SUPPORTED_EXTENSIONS:
        return True

    return False


class PlaygroundAPIError(Exception):
    """Raised for controlled error responses."""

    def __init__(self, message: str, status_code: int):
        super().__init__(message)
        self.status_code = status_code


def _public_error_message(exc: PlaygroundAPIError) -> str:
    """Translate internal errors into user-facing language without leaking details."""
    messages = {
        400: "Bad request",
        401: "Unauthorized",
        404: "File not found",
        500: "Server error",
    }
    return messages.get(exc.status_code, "Request failed")


T = TypeVar("T")


def _coerce_to_dataclass(data: Any, cls: Type[T]) -> T:
    """Allow route decorators to pass either dicts or dataclass instances uniformly."""
    if isinstance(data, cls):
        return data
    if isinstance(data, dict):
        return cls(**data)
    raise PlaygroundAPIError("Invalid request payload", 400)


def _get_authenticated_oid() -> str:
    """Extract the caller's AAD object id to isolate blobs per user."""
    user = user_ad.current_user()  # type: ignore[attr-defined]
    if not user:
        raise PlaygroundAPIError("Invalid access token", 401)

    token_payload = getattr(user, "token", None)
    if not isinstance(token_payload, dict):
        raise PlaygroundAPIError("OID not found in token", 401)

    oid = token_payload.get("oid")
    if not oid:
        raise PlaygroundAPIError("OID not found in token", 401)

    return oid


def _get_container_client() -> ContainerClient:
    """Return the shared container client for chat attachments."""
    client = get_blob_service_client()
    return client.get_container_client(CONTAINER_NAME)


def _sanitize_blob_name(blob_name: str) -> Optional[str]:
    """Strip dangerous path characters to avoid traversal or invalid lookups."""
    if not blob_name:
        return None
    cleaned = blob_name.strip().lstrip("/").rstrip("/")
    if not cleaned or ".." in cleaned.split("/") or "\\" in cleaned:
        return None
    return cleaned


def _blob_name_from_url(file_url: str, container_client: ContainerClient) -> Optional[str]:
    """Translate a signed blob URL into a relative path within the container."""
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
    """Resolve the blob client for a request while enforcing the user's prefix boundary."""
    candidate = blob_name
    if candidate:
        candidate = _sanitize_blob_name(candidate)
    elif file_url:
        candidate = _blob_name_from_url(file_url, container_client)

    if not candidate or not candidate.startswith(f"{oid}/"):
        return None

    return container_client.get_blob_client(candidate)


def _resolve_optional_oid() -> Tuple[Optional[str], Optional[PlaygroundAPIError]]:
    """Attempt to authenticate but allow anonymous callers for read-only APIs."""
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
    """Download bytes for either authenticated users (restricted prefix) or SAS links.

    Args:
        file_url: Absolute blob URL supplied by the client when downloading anonymously.
        blob_name: Relative path inside the container when the UI already knows the blob name.
        requested_type: MIME hint provided by the caller so we can short-circuit lookups.
        oid: Authenticated caller's object id; when provided we enforce the per-user prefix.
        auth_error: Cached auth error returned by ``_resolve_optional_oid`` to bubble up later.

    Returns:
        Tuple of the file bytes and best-effort content type guess.

    Raises:
        PlaygroundAPIError: If the blob cannot be located, is marked deleted, or storage fails.
    """
    container_client = _get_container_client()

    if oid:
        # Signed-in callers are restricted to blobs under their personal prefix to prevent cross-user access.
        blob_client = _get_blob_client_for_request(file_url, blob_name, oid, container_client)
        if not blob_client:
            raise PlaygroundAPIError("File not found", 404)
        try:
            props = blob_client.get_blob_properties()
            metadata = getattr(props, "metadata", {}) or {}
            if _is_marked_deleted(metadata):
                raise PlaygroundAPIError("File not found", 404)
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

    relative_path = _blob_name_from_url(file_url, container_client)
    if not relative_path:
        raise PlaygroundAPIError("File not found", 404)

    blob_client = container_client.get_blob_client(relative_path)
    try:
        props = blob_client.get_blob_properties()
        metadata = getattr(props, "metadata", {}) or {}
        if _is_marked_deleted(metadata):
            raise PlaygroundAPIError("File not found", 404)
        file_bytes = blob_client.download_blob(max_concurrency=1).readall()
    except ResourceNotFoundError as exc:
        raise PlaygroundAPIError("File not found", 404) from exc
    except AzureError as exc:
        logger.exception("Failed to fetch blob via URL lookup", extra={"blob_name": relative_path})
        raise PlaygroundAPIError("Failed to fetch file", 500) from exc

    content_type = (
        requested_type
        or getattr(getattr(props, "content_settings", None), "content_type", None)
        or "application/octet-stream"
    )
    return file_bytes, content_type

# GET /api/playground/files-for-session: Returns files for a given sessionId by searching blob metadata
@api_playground.get("/files-for-session")
@api_playground.doc(
    summary="List files for a session",
    description="Return metadata for the caller's files associated with the provided sessionId.",
    security="ApiKeyAuth",
)
@api_playground.input(PlaygroundSessionFilesQuery.Schema, location="query", arg_name="query")  # type: ignore[attr-defined]
@api_playground.output(PlaygroundFilesResponse.Schema)  # type: ignore[attr-defined]
@auth.login_required(role="chat")
@user_ad.login_required
def files_for_session(query: PlaygroundSessionFilesQuery):
    """Return metadata for every file the caller uploaded for the requested session id.

    The handler walks the authenticated user's prefix, skips any soft-deleted blobs, and
    emits the normalized metadata structure consumed by the React playground.
    """
    try:
        query = _coerce_to_dataclass(query, PlaygroundSessionFilesQuery)
    except PlaygroundAPIError as exc:
        return {"message": _public_error_message(exc)}, exc.status_code

    session_id = query.sessionId

    try:
        oid = _get_authenticated_oid()
    except PlaygroundAPIError as exc:
        logger.info("Files-for-session request blocked: %s", exc)
        return {"message": _public_error_message(exc)}, exc.status_code

    try:
        container_client = _get_container_client()
        blob_list = container_client.list_blobs(name_starts_with=f"{oid}/", include=["metadata"])
        files: List[Dict[str, Any]] = []
        deleted_sessions: set[str] = set()
        for blob in blob_list:
            meta = getattr(blob, "metadata", {}) or {}
            session_from_meta = meta.get("sessionid")
            if _is_marked_deleted(meta):
                if session_from_meta:
                    deleted_sessions.add(session_from_meta)
                continue
            if session_id and session_from_meta != session_id:
                continue
            content_type = None
            content_settings = getattr(blob, "content_settings", None)
            if content_settings:
                content_type = getattr(content_settings, "content_type", None)
            # Mirror the frontend's ``FileAttachment`` shape so responses hydrate Redux as-is.
            files.append(
                {
                    "name": blob.name,
                    "url": f"{container_client.url}/{blob.name}",
                    "blobName": blob.name,
                    "size": getattr(blob, "size", None),
                    "contentType": content_type,
                    "originalName": meta.get("originalname"),
                    "uploadedAt": meta.get("uploadedat"),
                    "sessionId": meta.get("sessionid"),
                    "category": meta.get("category"),
                    "metadataType": meta.get("type"),
                    "sessionName": meta.get("sessionname"),
                    "lastUpdated": meta.get("lastupdated"),
                }
            )
        response: Dict[str, Any] = {"files": files}
        if deleted_sessions:
            response["deletedSessionIds"] = sorted(deleted_sessions)
        if session_id:
            response["sessionDeleted"] = session_id in deleted_sessions and not files
        return response
    except ResourceNotFoundError:
        return {"files": []}
    except AzureError:
        logger.exception("Failed to list files for session %s", session_id)
        return {"message": "Failed to list files"}, 500


# POST /api/1.0/upload: Accepts encoded_file, name, and access token, uploads to Azure Blob Storage with user_id metadata
@api_playground.post("/upload")
@api_playground.doc(
    summary="Upload a file for the playground session",
    description="Persist a base64 encoded file in blob storage for the signed-in user.",
    security="ApiKeyAuth",
)
@api_playground.input(PlaygroundUploadRequest.Schema, arg_name="upload_request")  # type: ignore[attr-defined]
@api_playground.output(PlaygroundUploadResponse.Schema)  # type: ignore[attr-defined]
@auth.login_required(role="chat")
@user_ad.login_required
def upload_file(upload_request: PlaygroundUploadRequest):
    """Persist a base64 encoded file in blob storage for the signed-in user.

    The payload comes from the playground UI and always includes a ``data:`` URL. We sanitize
    file names, enforce the same attachment policy used by the production app, and stamp
    metadata that allows the session bootstrapper to recover archives later on.
    """
    try:
        upload_request = _coerce_to_dataclass(upload_request, PlaygroundUploadRequest)
    except PlaygroundAPIError as exc:
        return {"message": _public_error_message(exc)}, exc.status_code
    encoded_file = upload_request.encoded_file
    original_name = upload_request.name
    session_id = upload_request.sessionId or upload_request.session_id
    category = (upload_request.category or "files").lower()
    safe_category = "chat" if category not in {"files", "chat"} else category
    mime_type = upload_request.fileType or upload_request.mimeType or upload_request.type
    metadata_input = upload_request.metadata
    extra_metadata: Dict[str, Any] = metadata_input if isinstance(metadata_input, dict) else {}

    if not encoded_file or not original_name:
        return {"message": "encoded_file and name are required"}, 400

    try:
        oid = _get_authenticated_oid()
    except PlaygroundAPIError as exc:
        logger.info("Upload request blocked: %s", exc)
        return {"message": _public_error_message(exc)}, exc.status_code

    normalized_name = secure_filename(original_name)
    if not normalized_name:
        return {"message": "Invalid file name"}, 400

    encoded_payload = encoded_file
    if encoded_payload.startswith("data:"):
        encoded_payload = encoded_payload.split(",", 1)[-1]
    try:
        file_bytes = base64.b64decode(encoded_payload)
    except Exception:
        return {"message": "Failed to decode file"}, 400

    resolved_mime = mime_type or mimetypes.guess_type(normalized_name)[0]
    if not _is_supported_file(resolved_mime, normalized_name, safe_category):
        return {"message": "Unsupported file type"}, 400
    mime_type = resolved_mime or mime_type

    session_segment = f"{session_id}/" if session_id else ""

    if safe_category == "chat":
        if not session_id:
            return {"message": "sessionId is required for chat archives"}, 400

        sanitized_session = secure_filename(str(session_id)) or str(session_id)
        base_filename = f"{sanitized_session}.chat.json"
        blob_name = f"{oid}/{base_filename}"
    else:
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
    metadata["deleted"] = "false"
    for key, value in extra_metadata.items():
        if value is None:
            continue
        metadata[str(key).lower()] = str(value)

    metadata["lastupdated"] = uploaded_at

    try:
        container_client = _get_container_client()
    except AzureError:
        logger.exception("Failed to access blob service for oid %s", oid)
        return {"message": "Upload failed"}, 500

    try:
        container_client.create_container()
    except ResourceExistsError:
        pass
    except AzureError:
        logger.exception("Failed to ensure container exists for oid %s", oid)
        return {"message": "Upload failed"}, 500

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
        return {"message": "Upload failed"}, 500

    file_payload = {
        "name": blob_name,
        "url": blob_url,
        "blobName": blob_name,
        "size": len(file_bytes),
        "contentType": mime_type,
        "originalName": original_name,
        "uploadedAt": uploaded_at,
        "lastUpdated": metadata.get("lastupdated"),
        "sessionId": str(session_id) if session_id else None,
        "category": safe_category,
        "metadataType": metadata.get("type"),
        "sessionName": metadata.get("sessionname"),
    }
    return {"file": file_payload, "message": "Uploaded"}


@api_playground.delete("/sessions/<string:session_id>")
@api_playground.doc(
    summary="Soft delete a playground session",
    description="Marks all blobs associated with the session as deleted without removing the files.",
    security="ApiKeyAuth",
)
@auth.login_required(role="chat")
@user_ad.login_required
def delete_session(session_id: str):
<<<<<<< HEAD
    """Mark every blob tied to the caller's session as deleted so the UI stops rehydrating it.

    Instead of hard-deleting blobs we toggle metadata, allowing the recovery scripts to
    rehydrate data if needed for auditing or debugging.
    """
=======
    """Mark all files for the caller's session as deleted in blob metadata."""
>>>>>>> 7e322aa (Add remote session deletion handling and cover soft delete metadata)
    if not session_id:
        return {"message": "session_id is required"}, 400

    try:
        oid = _get_authenticated_oid()
    except PlaygroundAPIError as exc:
        logger.info("Delete-session request blocked: %s", exc)
        return {"message": _public_error_message(exc)}, exc.status_code

    try:
        container_client = _get_container_client()
    except AzureError:
        logger.exception("Failed to access blob service for oid %s", oid)
        return {"message": "Delete failed"}, 500

    timestamp = datetime.utcnow().isoformat() + "Z"
<<<<<<< HEAD
    sanitized_session = secure_filename(str(session_id)) or str(session_id)

    try:
        # Only enumerate blobs that live under the authenticated user's prefix so we never touch someone else's files.
        blobs_iterator = container_client.list_blobs(name_starts_with=f"{oid}/", include=["metadata"])
    except ResourceNotFoundError:
        return {
            "success": False,
            "message": f"Session {session_id} not found",
        }, 404
=======
    deleted_count = 0
    failed: List[str] = []

    try:
        blobs_iterator = container_client.list_blobs(name_starts_with=f"{oid}/", include=["metadata"])
    except ResourceNotFoundError:
        return {"deletedCount": 0}
>>>>>>> 7e322aa (Add remote session deletion handling and cover soft delete metadata)
    except AzureError:
        logger.exception("Failed to enumerate blobs for delete", extra={"oid": oid})
        return {"message": "Delete failed"}, 500

<<<<<<< HEAD
    deleted_count = 0
    failed: List[str] = []
    matched_session = False

    for blob in blobs_iterator:
        # Each session can have multiple blobs (archive + attachments); ensure we only touch the targeted session.
        metadata = getattr(blob, "metadata", {}) or {}
        if metadata.get("sessionid") != str(session_id):
            continue

        matched_session = True
        if _is_marked_deleted(metadata):
            continue

        # Normalize keys because Azure lowercases metadata keys, but tests/users may provide other casings.
        normalized_metadata = {str(k).lower(): str(v) for k, v in metadata.items() if v is not None}
        normalized_metadata["deleted"] = DELETED_FLAG_VALUE
        normalized_metadata["deletedat"] = timestamp
        normalized_metadata["lastupdated"] = timestamp

        blob_client = container_client.get_blob_client(blob.name)
        try:
            blob_client.set_blob_metadata(normalized_metadata)
=======
    for blob in blobs_iterator:
        metadata = getattr(blob, "metadata", {}) or {}
        if metadata.get("sessionid") != str(session_id):
            continue
        if _is_marked_deleted(metadata):
            continue
        metadata = {str(k).lower(): str(v) for k, v in metadata.items() if v is not None}
        metadata["deleted"] = DELETED_FLAG_VALUE
        metadata["deletedat"] = timestamp
        metadata["lastupdated"] = timestamp

        blob_client = container_client.get_blob_client(blob.name)
        try:
            blob_client.set_blob_metadata(metadata)
>>>>>>> 7e322aa (Add remote session deletion handling and cover soft delete metadata)
            deleted_count += 1
        except AzureError:
            failed.append(blob.name)
            logger.exception(
                "Failed to mark blob deleted",
                extra={"oid": oid, "blob_name": blob.name},
            )

<<<<<<< HEAD
    if not matched_session:
        return {
            "success": False,
            "message": f"Session {session_id} not found",
        }, 404

    if failed:
        return {
            "success": False,
            "deletedCount": deleted_count,
            "message": f"Session {session_id} partially deleted. Retry to clean up remaining files.",
            "failed": failed,
        }, 207

    if deleted_count == 0:
        # All blobs already marked deleted.
        return {
            "success": True,
            "deletedCount": 0,
            "message": f"Session {session_id} already deleted",
        }

    return {
        "success": True,
        "deletedCount": deleted_count,
        "message": f"Session {session_id} successfully deleted",
    }
=======
    if failed:
        return {
            "message": "Delete completed with errors",
            "deletedCount": deleted_count,
            "failed": failed,
        }, 207

    return {"deletedCount": deleted_count}
>>>>>>> 7e322aa (Add remote session deletion handling and cover soft delete metadata)

# POST /api/playground/extract-file-text: Accepts fileUrl and fileType, returns extracted text
@api_playground.post("/extract-file-text")
@api_playground.doc(
    summary="Extract text from a file",
    description="Fetch a remote file and extract plain text using the FileManager helper.",
)
@api_playground.input(PlaygroundExtractTextRequest.Schema, arg_name="payload")  # type: ignore[attr-defined]
@api_playground.output(PlaygroundExtractTextResponse.Schema)  # type: ignore[attr-defined]
def extract_file_text(payload: PlaygroundExtractTextRequest):
    """Fetch a remote file and extract plain text using the FileManager helper.

    The same endpoint also powers inline previews by returning a base64 ``dataUrl`` when
    ``responseFormat`` is set to ``data_url``.
    """
    try:
        payload = _coerce_to_dataclass(payload, PlaygroundExtractTextRequest)
    except PlaygroundAPIError as exc:
        return {"error": _public_error_message(exc)}, exc.status_code
    file_url = payload.fileUrl
    blob_name = payload.blobName
    requested_type = payload.fileType
    response_format = (payload.responseFormat or "text").strip().lower()
    if not file_url and not blob_name:
        return {"error": "fileUrl or blobName is required"}, 400

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
        logger.info("Extract-file-text request failed: %s", exc)
        return {"error": _public_error_message(exc)}, exc.status_code

    if response_format == "data_url":
        content_type = resolved_type or requested_type or "application/octet-stream"
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        data_url = f"data:{content_type};base64,{encoded}"
        return {"dataUrl": data_url, "contentType": content_type}

    try:
        fm = FileManager(file_bytes, resolved_type)
        text = fm.extract_text()
    except Exception:
        logger.exception(
            "Failed to extract text for resource", extra={"blob_name": blob_name, "file_url": file_url}
        )
        return {"error": "Failed to extract text"}, 500

    return {"extractedText": text}
