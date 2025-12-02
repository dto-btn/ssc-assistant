import jwt
import pytest  # type: ignore[import]
from apiflask import APIFlask
from types import SimpleNamespace
from typing import Dict, Iterable

from playground import routes_playground


class FakeBlob:
    """In-memory stand-in that mimics the Blob properties the routes interact with."""

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
    """Tiny helper mirroring BlobClient#download_blob() output."""

    def __init__(self, data: bytes) -> None:
        self._data = data

    def readall(self) -> bytes:
        return self._data


class FakeBlobClient:
    """Wrap a FakeBlob with the subset of BlobClient behavior the routes call."""

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
    """Container-level façade tracking blobs per-name similar to Azure."""

    def __init__(self, url: str) -> None:
        self.url = url
        self._blobs: Dict[str, FakeBlob] = {}

    def add_blob(self, blob: FakeBlob) -> None:
        self._blobs[blob.name] = blob

    def create_container(self) -> None:  # pragma: no cover - mirrors SDK surface
        return None

    def list_blobs(self, name_starts_with: str = "", include: Iterable[str] | None = None):
        # The production SDK accepts an ``include`` kwarg. The fake ignores the
        # value entirely but keeps the signature so route code can pass it.
        _ = include
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
    """Return auth headers that satisfy the playground route decorators without AAD."""

    token = jwt.encode({"roles": ["chat"]}, "secret", algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    monkeypatch.setenv("SKIP_USER_VALIDATION", "true")
    return {
        "X-API-Key": token,
        "Authorization": "Bearer ignored",
    }


@pytest.fixture
def test_client():
    app = APIFlask(__name__)
    app.config["TESTING"] = True
    app.register_blueprint(routes_playground.api_playground, url_prefix="/api/playground")
    with app.test_client() as client:
        yield client


def _set_mock_clients(monkeypatch, container: FakeContainerClient):
    monkeypatch.setattr(routes_playground, "_get_container_client", lambda: container)
    monkeypatch.setattr(routes_playground, "_get_authenticated_oid", lambda: "user-123")


def test_delete_session_marks_metadata(monkeypatch, api_headers, test_client):
    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    blob_a = FakeBlob(
        "user-123/session-1.chat.json",
        {
            "sessionid": "session-1",
            "originalname": "session-1.chat.json",
            "uploadedat": "2023-01-01T00:00:00Z",
            "deleted": "false",
        },
        b"{}",
        "application/json",
    )
    blob_b = FakeBlob(
        "user-123/files/session-1/attachment.txt",
        {
            "sessionid": "session-1",
            "originalname": "attachment.txt",
            "uploadedat": "2023-01-02T00:00:00Z",
            "deleted": "false",
        },
        b"note",
        "text/plain",
    )
    other_session_blob = FakeBlob(
        "user-123/files/session-2/other.txt",
        {
            "sessionid": "session-2",
            "originalname": "other.txt",
            "uploadedat": "2023-01-03T00:00:00Z",
            "deleted": "false",
        },
        b"other",
        "text/plain",
    )
    for blob in (blob_a, blob_b, other_session_blob):
        container.add_blob(blob)

    _set_mock_clients(monkeypatch, container)

    response = test_client.delete("/api/playground/sessions/session-1", headers=api_headers)

    assert response.status_code == 200
    assert response.get_json() == {"deletedCount": 2}
    assert container.get_blob(blob_a.name).metadata["deleted"] == routes_playground.DELETED_FLAG_VALUE
    assert container.get_blob(blob_b.name).metadata["deleted"] == routes_playground.DELETED_FLAG_VALUE
    assert container.get_blob(other_session_blob.name).metadata["deleted"] == "false"


def test_delete_session_returns_zero_when_no_matches(monkeypatch, api_headers, test_client):
    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    _set_mock_clients(monkeypatch, container)

    response = test_client.delete("/api/playground/sessions/missing", headers=api_headers)

    assert response.status_code == 200
    assert response.get_json() == {"deletedCount": 0}


def test_files_for_session_excludes_deleted(monkeypatch, api_headers, test_client):
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

    _set_mock_clients(monkeypatch, container)

    response = test_client.get(
        "/api/playground/files-for-session",
        query_string={"sessionId": "session-1"},
        headers=api_headers,
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert len(payload["files"]) == 1
    assert payload["files"][0]["blobName"] == active_blob.name
    assert sorted(payload["deletedSessionIds"]) == ["session-2"]
    assert payload["sessionDeleted"] is False


def test_extract_file_text_rejects_deleted_blob(monkeypatch, test_client):
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

    response = test_client.post(
        "/api/playground/extract-file-text",
        json={"blobName": deleted_blob.name},
    )

    assert response.status_code == 404
    payload = response.get_json()
    assert payload["error"] == "File not found"


def test_rename_session_updates_metadata(monkeypatch, api_headers, test_client):
    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    blob_a = FakeBlob(
        "user-123/session-1.chat.json",
        {
            "sessionid": "session-1",
            "sessionname": "Old",
            "deleted": "false",
        },
        b"{}",
        "application/json",
    )
    blob_b = FakeBlob(
        "user-123/files/session-1/file.txt",
        {
            "sessionid": "session-1",
            "sessionname": "Old",
            "deleted": "false",
        },
        b"data",
        "text/plain",
    )
    other_session = FakeBlob(
        "user-123/files/session-2/a.txt",
        {
            "sessionid": "session-2",
            "sessionname": "Another",
            "deleted": "false",
        },
        b"data",
        "text/plain",
    )
    for blob in (blob_a, blob_b, other_session):
        container.add_blob(blob)

    _set_mock_clients(monkeypatch, container)

    response = test_client.post(
        "/api/playground/sessions/session-1/rename",
        headers=api_headers,
        json={"name": "Renamed Session"},
    )

    assert response.status_code == 200
    payload = response.get_json()
    assert payload["updatedCount"] == 2
    assert payload.get("failed") == []
    assert container.get_blob(blob_a.name).metadata["sessionname"] == "Renamed Session"
    assert container.get_blob(blob_b.name).metadata["sessionname"] == "Renamed Session"
    assert container.get_blob(other_session.name).metadata["sessionname"] == "Another"


def test_rename_session_missing_returns_404(monkeypatch, api_headers, test_client):
    container = FakeContainerClient("https://example.com/assistant-chat-files-v2")
    _set_mock_clients(monkeypatch, container)

    response = test_client.post(
        "/api/playground/sessions/unknown/rename",
        headers=api_headers,
        json={"name": "Does Not Exist"},
    )

    assert response.status_code == 404
    payload = response.get_json()
    assert payload.get("failed") == []
