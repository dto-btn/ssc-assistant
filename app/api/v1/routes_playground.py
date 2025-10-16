from flask import request, jsonify
import base64
import uuid
from datetime import datetime
from typing import Dict, Any

from werkzeug.utils import secure_filename

from utils.auth import verify_user_access_token
from utils.azure_clients import get_blob_service_client
from utils.file_manager import FileManager
import requests
from apiflask import APIBlueprint
from azure.storage.blob import ContentSettings

api_playground = APIBlueprint("api_playground", __name__)

# GET /api/playground/files-for-session: Returns files for a given sessionId by searching blob metadata
@api_playground.route("/files-for-session", methods=["GET"])
def files_for_session():
    session_id = request.args.get("sessionId")
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"message": "Missing or invalid Authorization header"}), 401
    access_token = auth_header.split(" ", 1)[1]
    user = verify_user_access_token(access_token)
    if not user or not getattr(user, "token", None):
        return jsonify({"message": "Invalid access token"}), 401
    payload = user.token
    oid = None
    if isinstance(payload, dict):
        oid = payload.get("oid")
    if not oid:
        return jsonify({"message": "OID not found in token"}), 401
    if not session_id:
        return jsonify({"message": "sessionId is required"}), 400

    try:
        client = get_blob_service_client()
        container = "assistant-chat-files-v2"
        container_client = client.get_container_client(container)
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
    except Exception as exc:
        return jsonify({"message": f"Failed to list files: {exc}"}), 500


# POST /api/1.0/upload: Accepts encoded_file, name, and access token, uploads to Azure Blob Storage with user_id metadata
@api_playground.route("/upload", methods=["POST"])
def upload_file():
    data: Dict[str, Any] = request.get_json() or {}
    encoded_file = data.get("encoded_file")
    original_name = data.get("name")
    session_id = data.get("sessionId") or data.get("session_id")
    category = (data.get("category") or "files").lower()
    mime_type = data.get("fileType") or data.get("mimeType") or data.get("type")
    metadata_input = data.get("metadata")
    extra_metadata: Dict[str, Any] = metadata_input if isinstance(metadata_input, dict) else {}

    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return jsonify({"message": "Missing or invalid Authorization header"}), 401
    access_token = auth_header.split(" ", 1)[1]
    if not encoded_file or not original_name:
        return jsonify({"message": "encoded_file and name are required"}), 400

    user = verify_user_access_token(access_token)
    if not user or not getattr(user, "token", None):
        return jsonify({"message": "Invalid access token"}), 401
    payload = user.token
    oid = None
    if isinstance(payload, dict):
        oid = payload.get("oid")
    if not oid:
        return jsonify({"message": "OID not found in token"}), 401

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
        client = get_blob_service_client()
        container = "assistant-chat-files-v2"
        container_client = client.get_container_client(container)
        try:
            container_client.create_container()
        except Exception:
            pass
        blob_client = container_client.get_blob_client(blob_name)
        content_settings = ContentSettings(content_type=mime_type) if mime_type else None
        blob_client.upload_blob(
            file_bytes,
            overwrite=True,
            metadata=metadata,
            content_settings=content_settings,
        )
        blob_url = blob_client.url
    except Exception as exc:
        return jsonify({"message": f"Upload failed: {exc}"}), 500

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
    data = request.get_json() or {}
    file_url = data.get("fileUrl")
    file_type = data.get("fileType")
    if not file_url:
        return jsonify({"error": "fileUrl is required"}), 400
    try:
        resp = requests.get(file_url, timeout=10)
        resp.raise_for_status()
        file_bytes = resp.content
        fm = FileManager(file_bytes, file_type or "")
        text = fm.extract_text()
        return jsonify({"extractedText": text})
    except Exception as exc:
        return jsonify({"error": f"Failed to extract text: {exc}"}), 500


@api_playground.route("/file-data-url", methods=["POST"])
def file_data_url():
    data = request.get_json() or {}
    file_url = data.get("fileUrl")
    file_type = data.get("fileType")
    if not file_url:
        return jsonify({"error": "fileUrl is required"}), 400
    try:
        resp = requests.get(file_url, timeout=10)
        resp.raise_for_status()
        file_bytes = resp.content
        content_type = file_type or resp.headers.get("Content-Type") or "application/octet-stream"
        encoded = base64.b64encode(file_bytes).decode("utf-8")
        data_url = f"data:{content_type};base64,{encoded}"
        return jsonify({
            "dataUrl": data_url,
            "contentType": content_type,
        })
    except Exception as exc:
        return jsonify({"error": f"Failed to fetch file: {exc}"}), 500