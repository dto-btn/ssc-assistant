"""Tests for the server-owned MCP registry used by the playground proxy."""

import json

import pytest

from playground import mcp_registry


@pytest.fixture(autouse=True)
def _clear_registry_env(monkeypatch):
    monkeypatch.delenv("PLAYGROUND_MCP_SERVERS", raising=False)


def _set_registry(monkeypatch, entries):
    monkeypatch.setenv("PLAYGROUND_MCP_SERVERS", json.dumps(entries))


def test_get_registry_skips_malformed_entries(monkeypatch):
    _set_registry(monkeypatch, [
        {"server_label": "BITS", "server_description": "d", "server_url": "https://bits.internal/mcp"},
        {"server_label": "no-url"},
        "not-a-dict",
    ])

    registry = mcp_registry.get_registry()

    assert len(registry) == 1
    assert registry[0]["id"] == "bits"
    assert registry[0]["server_url"] == "https://bits.internal/mcp"


def test_sanitized_servers_never_expose_urls(monkeypatch):
    _set_registry(monkeypatch, [
        {"id": "bits_mcp", "server_label": "BITS", "server_description": "d", "server_url": "https://x/mcp"},
    ])

    sanitized = mcp_registry.sanitized_servers()

    assert sanitized == [{
        "type": "mcp",
        "id": "bits_mcp",
        "server_label": "BITS",
        "server_description": "d",
        "require_approval": "never",
    }]
    assert all("server_url" not in entry for entry in sanitized)


def test_inject_mcp_tools_expands_refs_and_headers(monkeypatch):
    _set_registry(monkeypatch, [
        {"id": "bits_mcp", "server_label": "BITS", "server_description": "d",
         "server_url": "https://bits.internal/mcp", "headers": {"x-api-key": "secret"}},
    ])
    body = {"model": "gpt-4o", "tools": [
        {"type": "mcp", "server_label": "BITS", "server_url": "mcpref:bits_mcp", "require_approval": "never"},
    ]}

    result = mcp_registry.inject_mcp_tools(body)

    tool = result["tools"][0]
    assert tool["server_url"] == "https://bits.internal/mcp"
    assert tool["headers"]["x-api-key"] == "secret"


def test_inject_mcp_tools_drops_unknown_refs(monkeypatch):
    _set_registry(monkeypatch, [
        {"id": "bits_mcp", "server_label": "BITS", "server_description": "d", "server_url": "https://x/mcp"},
    ])
    body = {"tools": [
        {"type": "mcp", "server_url": "mcpref:bits_mcp"},
        {"type": "mcp", "server_url": "https://attacker.example/mcp"},
        {"type": "mcp", "server_url": "mcpref:not-in-registry"},
    ]}

    result = mcp_registry.inject_mcp_tools(body)

    assert len(result["tools"]) == 1
    assert result["tools"][0]["server_url"] == "https://x/mcp"


def test_inject_mcp_tools_passes_through_non_mcp_tools(monkeypatch):
    _set_registry(monkeypatch, [])
    body = {"tools": [{"type": "function", "name": "do_thing"}]}

    result = mcp_registry.inject_mcp_tools(body)

    assert result["tools"] == [{"type": "function", "name": "do_thing"}]


def test_sanitize_route_response_strips_endpoints():
    payload = {"recommendations": [
        {"mcp_server_id": "bits_mcp", "endpoint": "https://internal/mcp", "confidence": 1},
        {"mcp_server_id": "pmcoe_mcp"},
    ]}

    sanitized = mcp_registry.sanitize_route_response(payload)

    assert all("endpoint" not in rec for rec in sanitized["recommendations"])
    assert sanitized["recommendations"][0]["mcp_server_id"] == "bits_mcp"
