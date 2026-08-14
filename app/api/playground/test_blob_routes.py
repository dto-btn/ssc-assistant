"""Tests for the server-side blob streaming route."""

import jwt
import pytest
from apiflask import APIFlask
from azure.core.exceptions import ResourceNotFoundError

from playground import blob_routes


class _FakeContentSettings:
    def __init__(self, content_type):
        self.content_type = content_type


class _FakeDownloader:
    def __init__(self, data, content_type):
        self._data = data
        self.properties = type("Props", (), {"content_settings": _FakeContentSettings(content_type)})()

    def readall(self):
        return self._data


class _FakeBlobClient:
    def __init__(self, data, content_type, missing=False):
        self._data = data
        self._content_type = content_type
        self._missing = missing

    def download_blob(self, max_concurrency=1):
        if self._missing:
            raise ResourceNotFoundError("missing")
        return _FakeDownloader(self._data, self._content_type)


class _FakeContainerClient:
    def __init__(self, blob_client):
        self._blob_client = blob_client

    def get_blob_client(self, name):
        self._requested_name = name
        return self._blob_client


class _FakeServiceClient:
    def __init__(self, container_client):
        self._container_client = container_client

    def get_container_client(self, container):
        self.requested_container = container
        return self._container_client


@pytest.fixture
def api_headers(monkeypatch):
    token = jwt.encode({"roles": ["chat"]}, "secret", algorithm="HS256")
    if isinstance(token, bytes):
        token = token.decode("utf-8")
    monkeypatch.setenv("SKIP_USER_VALIDATION", "true")
    return {"X-API-Key": token}


@pytest.fixture
def client():
    app = APIFlask(__name__)
    app.config["TESTING"] = True
    app.register_blueprint(blob_routes.api_playground_blob, url_prefix="/api/playground")
    with app.test_client() as test_client:
        yield test_client


def _mock_service(monkeypatch, blob_client):
    service = _FakeServiceClient(_FakeContainerClient(blob_client))
    monkeypatch.setattr(blob_routes, "get_blob_service_client", lambda: service)
    return service


def test_get_blob_streams_allowlisted_container(client, api_headers, monkeypatch):
    _mock_service(monkeypatch, _FakeBlobClient(b"imgbytes", "image/png"))

    resp = client.get("/api/playground/blob/assistant-chat-files-v2/user-1/pic.png", headers=api_headers)

    assert resp.status_code == 200
    assert resp.data == b"imgbytes"
    assert resp.content_type == "image/png"


def test_get_blob_rejects_unknown_container(client, api_headers, monkeypatch):
    _mock_service(monkeypatch, _FakeBlobClient(b"x", "image/png"))

    resp = client.get("/api/playground/blob/secret-container/foo.png", headers=api_headers)

    assert resp.status_code == 404


def test_get_blob_rejects_path_traversal(client, api_headers, monkeypatch):
    _mock_service(monkeypatch, _FakeBlobClient(b"x", "image/png"))

    resp = client.get("/api/playground/blob/pmcoe-latest/..%2f..%2fsecret", headers=api_headers)

    assert resp.status_code == 404


def test_get_blob_missing_returns_404(client, api_headers, monkeypatch):
    _mock_service(monkeypatch, _FakeBlobClient(b"", "image/png", missing=True))

    resp = client.get("/api/playground/blob/pmcoe-latest/missing.png", headers=api_headers)

    assert resp.status_code == 404


def test_get_blob_requires_api_key(client, monkeypatch):
    _mock_service(monkeypatch, _FakeBlobClient(b"x", "image/png"))

    resp = client.get("/api/playground/blob/assistant-chat-files-v2/pic.png")

    assert resp.status_code == 401
