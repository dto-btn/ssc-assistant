import jwt
import pytest  # type: ignore[import]
from types import SimpleNamespace
from typing import Dict, Iterable

from app.api.app import app as flask_app
from app.api.playground import routes_playground

# pylint: disable=redefined-outer-name


class FakeBlob:
    """In-memory stand in that mimics the Azure Blob API surface the routes expect."""

    def __init__(
        self,
        name: str,
        metadata: Dict[str, str],
        data: bytes = b"",
        content_type: str = "application/octet-stream",
    ) -> None:
        self.name = name
        self.metadata = dict(metadata)
        self.data = data
        self.size = len(data)
        self.content_settings = SimpleNamespace(content_type=content_type)


class FakeDownload:
    """Tiny helper that exposes the ``readall`` call that BlobClient#download_blob returns."""

    def __init__(self, data: bytes) -> None:
        self._data = data

    def readall(self) -> bytes:
        return self._data


class FakeBlobClient:
    """Wrap a FakeBlob with the subset of BlobClient behavior used inside the routes."""

    def __init__(self, container: "FakeContainerClient", blob: FakeBlob) -> None:
        self._container = container
        self._blob = blob

    @property
    def url(self) -> str:
        return f"{self._container.url}/{self._blob.name}"

    def get_blob_properties(self) -> SimpleNamespace:
        return SimpleNamespace(
            metadata=dict(self._blob.metadata),
            content_settings=self._blob.content_settings,
        )

    def download_blob(self, _max_concurrency: int = 1) -> FakeDownload:
        return FakeDownload(self._blob.data)

    def set_blob_metadata(self, metadata: Dict[str, str]) -> None:
        self._blob.metadata = dict(metadata)


class FakeContainerClient:
    """Container-level façade that tracks blobs per-name just like Azure would."""

    def __init__(self, url: str) -> None:
        self.url = url
        self._blobs: Dict[str, FakeBlob] = {}

    def add_blob(self, blob: FakeBlob) -> None:
        self._blobs[blob.name] = blob

    def create_container(self) -> None:  # pragma: no cover - not used but mirrors API
        return None

    def list_blobs(self, name_starts_with: str = "", _include: Iterable[str] | None = None):
        return [blob for name, blob in self._blobs.items() if name.startswith(name_starts_with)]

    def get_blob_client(self, name: str) -> FakeBlobClient:
        try:
            blob = self._blobs[name]
        except KeyError as exc:  # pragma: no cover - defensive
            raise routes_playground.ResourceNotFoundError(message="Blob not found") from exc
        return FakeBlobClient(self, blob)

    def get_blob(self, name: str) -> FakeBlob:
        return self._blobs[name]


@pytest.fixture
def api_headers(monkeypatch):
    """Return auth headers that satisfy the route decorators without hitting AAD."""

    token = jwt.encode({"roles": ["chat"]}, "secret", algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    monkeypatch.setenv("SKIP_USER_VALIDATION", "true")
    return {
        "X-API-Key": token,
        "Authorization": "Bearer ignored",
    }


def test_delete_session_marks_metadata(monkeypatch, api_headers):
    """Soft-delete should toggle every blob under the requested session and set timestamps."""

    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    target_blob = FakeBlob(
        "user-123/session-1.chat.json",
        {
            "sessionid": "session-1",
            "originalname": "archive.chat.json",
            "uploadedat": "2023-01-01T00:00:00Z",
            "deleted": "false",
        },
        b"{}",
        "application/json",
    )
    container.add_blob(target_blob)
    attachment_blob = FakeBlob(
        "user-123/files/session-1/attachment.txt",
        {
            "sessionid": "session-1",
            "originalname": "attachment.txt",
            "uploadedat": "2023-01-01T00:00:00Z",
            "deleted": "false",
        },
        b"note",
        "text/plain",
    )
    container.add_blob(attachment_blob)
    monkeypatch.setattr(routes_playground, "_get_container_client", lambda: container)
    monkeypatch.setattr(routes_playground, "_get_authenticated_oid", lambda: "user-123")

    with flask_app.test_client() as client:
        response = client.delete("/api/playground/sessions/session-1", headers=api_headers)

    assert response.status_code == 200
    payload = response.get_json()
    assert payload == {
        "success": True,
        "deletedCount": 2,
        "message": "Session session-1 successfully deleted",
    }

    updated_blob = container.get_blob(target_blob.name)
    assert updated_blob.metadata["deleted"] == routes_playground.DELETED_FLAG_VALUE
    assert "deletedat" in updated_blob.metadata
    assert updated_blob.metadata["lastupdated"] == updated_blob.metadata["deletedat"]
    assert container.get_blob(attachment_blob.name).metadata["deleted"] == routes_playground.DELETED_FLAG_VALUE


def test_delete_session_returns_not_found(monkeypatch, api_headers):
    """Deleting a missing session returns a 404 so the UI can alert the user."""

    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    monkeypatch.setattr(routes_playground, "_get_container_client", lambda: container)
    monkeypatch.setattr(routes_playground, "_get_authenticated_oid", lambda: "user-123")

    with flask_app.test_client() as client:
        response = client.delete("/api/playground/sessions/missing", headers=api_headers)

    assert response.status_code == 404
    assert response.get_json() == {
        "success": False,
        "message": "Session missing not found",
    }


def test_delete_session_already_deleted(monkeypatch, api_headers):
    """Repeat delete requests short-circuit when everything is already marked deleted."""

    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    deleted_blob = FakeBlob(
        "user-123/session-9.chat.json",
        {
            "sessionid": "session-9",
            "deleted": "true",
            "deletedat": "2023-01-01T00:00:00Z",
            "lastupdated": "2023-01-01T00:00:00Z",
        },
        b"{}",
        "application/json",
    )
    container.add_blob(deleted_blob)

    monkeypatch.setattr(routes_playground, "_get_container_client", lambda: container)
    monkeypatch.setattr(routes_playground, "_get_authenticated_oid", lambda: "user-123")

    with flask_app.test_client() as client:
        response = client.delete("/api/playground/sessions/session-9", headers=api_headers)

    assert response.status_code == 200
    assert response.get_json() == {
        "success": True,
        "deletedCount": 0,
        "message": "Session session-9 already deleted",
    }


def test_files_for_session_excludes_deleted(monkeypatch, api_headers):
    """Listing files filters out soft-deleted blobs but still reports the deleted session ids."""

    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    active_blob = FakeBlob(
        "user-123/files/session-1/a.txt",
        {
            "sessionid": "session-1",
            "originalname": "a.txt",
            "uploadedat": "2023-01-03T00:00:00Z",
            "deleted": "false",
            "category": "files",
        },
        b"content",
        "text/plain",
    )
    deleted_same_session = FakeBlob(
        "user-123/files/session-1/old.txt",
        {
            "sessionid": "session-1",
            "originalname": "old.txt",
            "uploadedat": "2023-01-01T00:00:00Z",
            "deleted": "true",
            "category": "files",
        },
        b"old",
        "text/plain",
    )
    deleted_other_session = FakeBlob(
        "user-123/files/session-2/b.txt",
        {
            "sessionid": "session-2",
            "originalname": "b.txt",
            "uploadedat": "2023-01-02T00:00:00Z",
            "deleted": "true",
            "category": "files",
        },
        b"other",
        "text/plain",
    )
    for blob in (active_blob, deleted_same_session, deleted_other_session):
        container.add_blob(blob)

    monkeypatch.setattr(routes_playground, "_get_container_client", lambda: container)
    monkeypatch.setattr(routes_playground, "_get_authenticated_oid", lambda: "user-123")

    with flask_app.test_client() as client:
        response = client.get(
            "/api/playground/files-for-session",
            query_string={"sessionId": "session-1"},
            headers=api_headers,
        )

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["files"]) == 1
    assert payload["files"][0]["blobName"] == active_blob.name
    assert sorted(payload["deletedSessionIds"]) == ["session-1", "session-2"]
    assert payload["sessionDeleted"] is False


def test_extract_file_text_rejects_deleted_blob(monkeypatch):
    """Text extraction refuses to download blobs that were previously soft-deleted."""

    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    deleted_blob = FakeBlob(
        "user-123/files/session-3/deleted.txt",
        {
            "sessionid": "session-3",
            "originalname": "deleted.txt",
            "uploadedat": "2023-01-04T00:00:00Z",
            "deleted": "true",
            "category": "files",
        },
        b"should not download",
        "text/plain",
    )
    container.add_blob(deleted_blob)

    monkeypatch.setattr(routes_playground, "_get_container_client", lambda: container)
    monkeypatch.setattr(routes_playground, "_resolve_optional_oid", lambda: ("user-123", None))
    monkeypatch.setattr(routes_playground, "_get_authenticated_oid", lambda: "user-123")

    with flask_app.test_client() as client:
        response = client.post(
            "/api/playground/extract-file-text",
            json={"blobName": deleted_blob.name},
        )

    assert response.status_code == 404
    payload = response.get_json()
    assert payload == {"error": "File not found"}
