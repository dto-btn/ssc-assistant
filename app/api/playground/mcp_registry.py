"""Server-owned MCP registry for the playground.

The backend holds the real MCP server URLs (and any per-server auth headers). The browser
only ever receives a sanitized view (no URLs) and refers to servers by an opaque id
(``mcpref:<id>``). The LiteLLM proxy expands those refs back to real endpoints before
forwarding upstream, so internal MCP URLs are never exposed to the browser and the browser
cannot make the model reach an arbitrary server.
"""

import json
import logging
import os
import re

logger = logging.getLogger(__name__)

# Opaque reference the browser uses in place of a real MCP URL: "mcpref:<id>".
MCP_REF_PREFIX = "mcpref:"


def sanitize_server_id(value: str) -> str:
    """Deterministic id from a label; MUST match the frontend ``sanitizeServerId``."""
    slug = re.sub(r"[^a-z0-9]+", "_", (value or "").lower()).strip("_")
    return slug or "unknown_mcp"


def get_registry() -> list[dict]:
    """Parse ``PLAYGROUND_MCP_SERVERS`` into full server records (URLs included).

    Server-side use only. Malformed entries are skipped so one bad row cannot disable the
    whole playground.
    """
    raw = (os.getenv("PLAYGROUND_MCP_SERVERS", "") or "").strip()
    if not raw:
        return []

    try:
        entries = json.loads(raw)
    except json.JSONDecodeError:
        logger.exception("PLAYGROUND_MCP_SERVERS is not valid JSON; no MCP servers loaded")
        return []

    if not isinstance(entries, list):
        logger.error("PLAYGROUND_MCP_SERVERS must be a JSON array")
        return []

    servers: list[dict] = []
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        label = str(entry.get("server_label") or "").strip()
        url = str(entry.get("server_url") or "").strip()
        if not label or not url:
            continue
        approval = entry.get("require_approval")
        raw_headers = entry.get("headers") if isinstance(entry.get("headers"), dict) else {}
        servers.append({
            "id": sanitize_server_id(entry.get("id") or label),
            "server_label": label,
            "server_description": str(entry.get("server_description") or ""),
            "server_url": url,
            "require_approval": approval if approval in ("always", "never") else "never",
            "headers": {str(k): str(v) for k, v in raw_headers.items()},
        })
    return servers


def sanitized_servers() -> list[dict]:
    """Browser-safe view of the registry: ids/labels/descriptions only, never URLs."""
    return [
        {
            "type": "mcp",
            "id": server["id"],
            "server_label": server["server_label"],
            "server_description": server["server_description"],
            "require_approval": server["require_approval"],
        }
        for server in get_registry()
    ]


def _resolve_tool_id(tool: dict) -> str:
    """Extract the registry id a browser-supplied MCP tool refers to."""
    server_url = str(tool.get("server_url") or "")
    if server_url.startswith(MCP_REF_PREFIX):
        return sanitize_server_id(server_url[len(MCP_REF_PREFIX):])
    # Fall back to the label so an id-less ref still resolves deterministically.
    return sanitize_server_id(tool.get("server_label") or "")


def inject_mcp_tools(body: dict) -> dict:
    """Replace opaque MCP tool refs with real endpoints from the server-owned registry.

    Unknown ids are dropped (fail closed) so the browser can never make the model reach an
    arbitrary URL. Non-MCP tools pass through untouched.
    """
    if not isinstance(body, dict):
        return body
    tools = body.get("tools")
    if not isinstance(tools, list):
        return body

    registry = {server["id"]: server for server in get_registry()}
    resolved: list = []
    for tool in tools:
        if not isinstance(tool, dict) or tool.get("type") != "mcp":
            resolved.append(tool)
            continue
        entry = registry.get(_resolve_tool_id(tool))
        if entry is None:
            logger.warning("Dropping MCP tool with unknown registry id ref=%r", tool.get("server_url"))
            continue
        new_tool = dict(tool)
        new_tool["server_url"] = entry["server_url"]
        new_tool["server_label"] = entry["server_label"]
        if entry["headers"]:
            merged = dict(new_tool["headers"]) if isinstance(new_tool.get("headers"), dict) else {}
            merged.update(entry["headers"])
            new_tool["headers"] = merged
        resolved.append(new_tool)

    new_body = dict(body)
    new_body["tools"] = resolved
    return new_body


def sanitize_route_response(payload):
    """Strip internal endpoint URLs from an orchestrator suggest-route response payload."""
    if not isinstance(payload, dict):
        return payload
    recommendations = payload.get("recommendations")
    if isinstance(recommendations, list):
        payload["recommendations"] = [
            {k: v for k, v in rec.items() if k != "endpoint"} if isinstance(rec, dict) else rec
            for rec in recommendations
        ]
    return payload
