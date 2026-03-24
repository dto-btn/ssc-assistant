import os

os.environ.setdefault("SKIP_USER_VALIDATION", "true")

import jwt
import pytest
from apiflask import APIFlask
from werkzeug.exceptions import BadRequest

from proxy.litellm import ROOT_PATH_PROXY_LITELLM, proxy_litellm
from proxy.litellm_proxy import (
    build_litellm_payload,
    extract_bearer_token_from_auth_header,
    get_gateway_adapter,
    PayloadValidationError,
    StandaloneHttpGatewayAdapter,
)

# pylint: disable=redefined-outer-name


@pytest.fixture
def api_headers(monkeypatch):
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
    app.register_blueprint(proxy_litellm, url_prefix=ROOT_PATH_PROXY_LITELLM)
    with app.test_client() as client:
        yield client


def test_build_litellm_payload_uses_default_model(monkeypatch):
    monkeypatch.setenv("LITELLM_DEFAULT_MODEL", "azure/gpt-4o-mini")

    payload = build_litellm_payload(
        payload={"input": "hello"},
        req_id="req-1",
        user_oid="user-1",
    )

    assert payload["model"] == "azure/gpt-4o-mini"
    assert payload["metadata"]["request_id"] == "req-1"
    assert payload["metadata"]["user_oid"] == "user-1"


def test_build_litellm_payload_strips_mcp_transport_by_default(monkeypatch):
    monkeypatch.setenv("LITELLM_DEFAULT_MODEL", "azure/gpt-4o-mini")
    monkeypatch.delenv("LITELLM_INJECT_MCP_TRANSPORT", raising=False)

    payload = build_litellm_payload(
        payload={
            "input": "hello",
            "tools": [
                {
                    "type": "mcp",
                    "server_label": "Orchestrator",
                    "server_url": "http://localhost:8000/mcp",
                    "transport": "sse",
                }
            ],
        },
        req_id="req-2",
        user_oid="user-2",
    )

    assert payload["tools"][0].get("transport") is None


def test_build_litellm_payload_injects_default_transport_when_enabled(monkeypatch):
    monkeypatch.setenv("LITELLM_DEFAULT_MODEL", "azure/gpt-4o-mini")
    monkeypatch.setenv("LITELLM_INJECT_MCP_TRANSPORT", "true")
    monkeypatch.setenv("LITELLM_DEFAULT_MCP_TRANSPORT", "http")

    payload = build_litellm_payload(
        payload={
            "input": "hello",
            "tools": [
                {
                    "type": "mcp",
                    "server_label": "Orchestrator",
                    "server_url": "http://localhost:8000/mcp",
                }
            ],
        },
        req_id="req-3",
        user_oid="user-3",
    )

    assert payload["tools"][0].get("transport") == "http"


def test_litellm_route_preserves_http_exception_status(monkeypatch, test_client, api_headers):
    monkeypatch.setenv("LITELLM_DEFAULT_MODEL", "azure/gpt-4o-mini")

    def _raise_bad_request(_payload):
        raise BadRequest("invalid tool payload")

    monkeypatch.setattr("proxy.litellm.run_litellm_responses", _raise_bad_request)

    response = test_client.post(
        "/proxy/litellm/v1/responses",
        json={"input": "hello", "model": "azure/gpt-4o-mini"},
        headers=api_headers,
    )

    assert response.status_code == 400
    assert response.get_data(as_text=True) == "invalid tool payload"
    assert response.headers.get("X-Request-Id")


def test_extract_bearer_token_from_auth_header_parses_valid_scheme():
    token = extract_bearer_token_from_auth_header("Bearer abc123")

    assert token == "abc123"


def test_build_litellm_payload_rejects_non_dict_payload():
    with pytest.raises(PayloadValidationError) as error:
        build_litellm_payload(payload=None, req_id="req-9", user_oid="user-9")

    assert error.value.status_code == 400


def test_build_litellm_payload_rejects_model_not_in_allow_list(monkeypatch):
    monkeypatch.setenv("LITELLM_ALLOWED_MODELS", "azure/gpt-4o-mini,openai/gpt-4.1-mini")

    with pytest.raises(PayloadValidationError) as error:
        build_litellm_payload(
            payload={"input": "hello", "model": "azure/gpt-4o"},
            req_id="req-10",
            user_oid="user-10",
        )

    assert error.value.status_code == 400
    assert "not allowed" in error.value.message


def test_litellm_route_stream_emits_done(monkeypatch, test_client, api_headers):
    monkeypatch.setenv("LITELLM_DEFAULT_MODEL", "azure/gpt-4o-mini")

    def _stream_events(_payload):
        yield {
            "type": "response.output_text.delta",
            "response": {
                "id": "resp_1",
                "model": "azure/gpt-4o-mini",
                "usage": {"input_tokens": 1, "output_tokens": 2, "total_tokens": 3},
            },
            "delta": "hello",
        }

    monkeypatch.setattr("proxy.litellm.run_litellm_responses", _stream_events)

    response = test_client.post(
        "/proxy/litellm/v1/responses",
        json={"input": "hello", "model": "azure/gpt-4o-mini", "stream": True},
        headers=api_headers,
    )

    body = response.get_data(as_text=True)
    assert response.status_code == 200
    assert response.headers.get("Content-Type", "").startswith("text/event-stream")
    assert "data: [DONE]" in body
    assert '"type": "response.output_text.delta"' in body


def test_get_gateway_adapter_selects_standalone_http_mode(monkeypatch):
    monkeypatch.setenv("LITELLM_GATEWAY_MODE", "standalone_http")

    adapter = get_gateway_adapter()

    assert isinstance(adapter, StandaloneHttpGatewayAdapter)


def test_standalone_http_adapter_raises_clear_runtime_error(monkeypatch):
    monkeypatch.setenv("LITELLM_GATEWAY_MODE", "standalone_http")

    adapter = get_gateway_adapter()

    with pytest.raises(RuntimeError) as error:
        adapter.run_responses({"model": "azure/gpt-4o-mini", "input": "hello"})

    assert "not implemented" in str(error.value)
