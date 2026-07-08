/**
 * Memory MCP service.
 *
 * Mirrors the orchestratorService connection pattern to talk to the
 * ssca-memory-server's /mcp endpoint via StreamableHTTPClientTransport
 * with the user's AAD Bearer token forwarded in the Authorization header.
 *
 * The OID is resolved server-side from the token — we never pass it as
 * an argument (IDOR boundary).
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import type { Tool } from "openai/resources/responses/responses.mjs";

const MEMORY_CLIENT_NAME = "ssc-playground-memory-client";
const MEMORY_CLIENT_VERSION = "1.0.0";

export const isMemoryServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("memory");
};

// ── Connection cache (reuse across calls within a session) ────────────────────

const _connections = new Map<string, Promise<{ client: Client; transport: StreamableHTTPClientTransport }>>();

const isLocalHost = (host: string): boolean =>
  ["localhost", "127.0.0.1"].includes(host.toLowerCase());

const normalizeMemoryMcpUrl = (rawUrl: string): URL => {
  const parsed = new URL(rawUrl.trim());
  const allowHttp = (import.meta.env.DEV ?? false) && isLocalHost(parsed.hostname) && parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !allowHttp) {
    throw new Error(`Memory MCP endpoint must use https:// (http:// allowed only for local dev). Got: ${rawUrl}`);
  }
  if (!parsed.pathname.endsWith("/mcp")) {
    parsed.pathname = parsed.pathname.replace(/\/$/, "") + "/mcp";
  }
  return parsed;
};

const connect = async (
  serverUrl: string,
  accessToken?: string
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> => {
  const url = normalizeMemoryMcpUrl(serverUrl);
  const key = url.toString();
  const cached = _connections.get(key);
  if (cached) return cached;

  const promise = (async () => {
    const client = new Client({ name: MEMORY_CLIENT_NAME, version: MEMORY_CLIENT_VERSION });
    const transport = new StreamableHTTPClientTransport(url, {
      requestInit: {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
      },
    });
    await client.connect(transport);
    return { client, transport };
  })();

  _connections.set(key, promise);
  try {
    return await promise;
  } catch (err) {
    _connections.delete(key);
    throw err;
  }
};

// ── Public API ────────────────────────────────────────────────────────────────

export const getMemories = async (
  servers: Tool.Mcp[],
  accessToken?: string,
  topK = 10
): Promise<Array<{ id: string; label: string; text: string }>> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return [];
  try {
    const { client } = await connect(server.server_url, accessToken);
    const result = await client.callTool({ name: "get_memories", arguments: { top_k: topK } });
    const content = extractContent(result);
    return (content?.memories as Array<{ id: string; label: string; text: string }>) ?? [];
  } catch (err) {
    console.warn("[memoryService] get_memories failed:", err);
    return [];
  }
};

export const saveMemory = async (
  servers: Tool.Mcp[],
  accessToken: string | undefined,
  userMessage: string,
  assistantResponse: string
): Promise<void> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return;
  try {
    const { client } = await connect(server.server_url, accessToken);
    await client.callTool({ name: "save_memory", arguments: { user_message: userMessage, assistant_response: assistantResponse } });
  } catch (err) {
    console.warn("[memoryService] save_memory failed:", err);
  }
};

export const getMemoryGraph = async (
  servers: Tool.Mcp[],
  accessToken?: string
): Promise<{ nodes: unknown[]; edges: unknown[] } | null> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return null;
  try {
    const { client } = await connect(server.server_url, accessToken);
    const result = await client.callTool({ name: "get_memory_graph", arguments: {} });
    return extractContent(result) as { nodes: unknown[]; edges: unknown[] } | null;
  } catch (err) {
    console.warn("[memoryService] get_memory_graph failed:", err);
    return null;
  }
};

export const getConsent = async (
  servers: Tool.Mcp[],
  accessToken?: string
): Promise<{ opt_in: boolean; consent_version: string | null; updated_at: string | null } | null> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return null;
  try {
    const { client } = await connect(server.server_url, accessToken);
    const result = await client.callTool({ name: "get_consent", arguments: {} });
    return extractContent(result) as { opt_in: boolean; consent_version: string | null; updated_at: string | null } | null;
  } catch (err) {
    console.warn("[memoryService] get_consent failed:", err);
    return null;
  }
};

export const setConsent = async (
  servers: Tool.Mcp[],
  accessToken: string | undefined,
  optIn: boolean
): Promise<void> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return;
  try {
    const { client } = await connect(server.server_url, accessToken);
    await client.callTool({ name: "set_consent", arguments: { opt_in: optIn } });
  } catch (err) {
    console.warn("[memoryService] set_consent failed:", err);
    throw err;
  }
};

export const deleteMemory = async (
  servers: Tool.Mcp[],
  accessToken: string | undefined,
  nodeId: string
): Promise<void> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return;
  try {
    const { client } = await connect(server.server_url, accessToken);
    await client.callTool({ name: "delete_memory", arguments: { node_id: nodeId } });
  } catch (err) {
    console.warn("[memoryService] delete_memory failed:", err);
    throw err;
  }
};

export const deleteAllMemories = async (
  servers: Tool.Mcp[],
  accessToken?: string
): Promise<void> => {
  const server = servers.find(isMemoryServer);
  if (!server?.server_url) return;
  try {
    const { client } = await connect(server.server_url, accessToken);
    await client.callTool({ name: "delete_all_memories", arguments: {} });
  } catch (err) {
    console.warn("[memoryService] delete_all_memories failed:", err);
    throw err;
  }
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function extractContent(result: unknown): Record<string, unknown> | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  // MCP SDK wraps tool results in { content: [{ type: "text", text: "..." }] }
  if (Array.isArray(r.content)) {
    for (const item of r.content) {
      if (item && typeof item === "object" && (item as Record<string, unknown>).type === "text") {
        const text = (item as Record<string, unknown>).text;
        if (typeof text === "string") {
          try { return JSON.parse(text); } catch { return null; }
        }
      }
    }
  }
  // Some implementations return the payload directly
  return r;
}
