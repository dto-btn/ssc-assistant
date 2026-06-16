/**
 * BITS (Business Request) MCP service for the playground.
 *
 * Replaces the legacy `api/1.0/bits/br/<n>` REST call with a direct MCP tool
 * invocation so the playground no longer depends on the main-chat backend.
 *
 * Endpoint discovery is dynamic:
 * 1. Prefer a BITS-labelled server already present in the configured MCP servers.
 * 2. Otherwise read the orchestrator registry resource and resolve `bits_mcp`.
 *
 * The connection uses streamable-http transport with the caller's MSAL bearer
 * token, mirroring the orchestrator client integration.
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Tool } from "openai/resources/responses/responses.mjs";
import { normalizeHttpsMcpUrl } from "./orchestratorService";

const BITS_CLIENT_NAME = "ssc-playground-bits-client";
const BITS_CLIENT_VERSION = "1.0.0";

/**
 * Tool exposed by the BITS MCP server that returns Business Request records.
 *
 * Matches the backend implementation (`tools/bits/bits_functions.py::get_br_information`)
 * which both the legacy REST endpoint and the MCP server wrap. The response shape
 * is `{ br: BusinessRequest[], metadata: {...} }`.
 */
const BITS_TOOL_NAME = "get_br_information";

const ORCHESTRATOR_REGISTRY_URI = "orchestrator://registry";

/**
 * Result returned by the BITS MCP `get_br_information` tool.
 */
export interface BusinessRequestLookupResult {
  br: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

/**
 * Detect whether an MCP server entry is the orchestrator itself.
 */
const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

/**
 * Heuristic match for a directly-configured BITS MCP server entry.
 */
const looksLikeBitsServer = (server: Tool.Mcp): boolean => {
  if (isOrchestratorServer(server)) {
    return false;
  }
  const haystack = `${server.server_label || ""} ${server.server_description || ""} ${server.server_url || ""}`.toLowerCase();
  return haystack.includes("bits") || haystack.includes("business-request") || haystack.includes("business request");
};

/**
 * Establish a streamable-http MCP client connection for a single request.
 */
const connectBitsClient = async (
  serverUrl: string,
  accessToken?: string,
): Promise<{ client: Client; transport: StreamableHTTPClientTransport }> => {
  const mcpUrl = normalizeHttpsMcpUrl(serverUrl);
  const client = new Client({
    name: BITS_CLIENT_NAME,
    version: BITS_CLIENT_VERSION,
  });
  const transport = new StreamableHTTPClientTransport(mcpUrl, {
    requestInit: {
      headers: accessToken
        ? {
            Authorization: `Bearer ${accessToken}`,
          }
        : undefined,
    },
  });
  await client.connect(transport);
  return { client, transport };
};

/**
 * Safely parse a JSON string, returning null on failure.
 */
const tryParseJson = (value: string): Record<string, unknown> | null => {
  try {
    const parsed = JSON.parse(value);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // no-op
  }
  return null;
};

/**
 * Extract a structured payload from an MCP tool/resource response.
 *
 * Handles both `structuredContent` and `content[].text` (JSON string) shapes.
 */
const extractPayload = (result: unknown): Record<string, unknown> | null => {
  if (!result || typeof result !== "object") {
    return null;
  }

  const record = result as Record<string, unknown>;

  const structured = record.structuredContent;
  if (structured && typeof structured === "object" && !Array.isArray(structured)) {
    return structured as Record<string, unknown>;
  }

  const content = record.content;
  if (Array.isArray(content)) {
    for (const entry of content) {
      if (!entry || typeof entry !== "object") continue;
      const text = (entry as Record<string, unknown>).text;
      if (typeof text !== "string") continue;
      const parsed = tryParseJson(text);
      if (parsed) {
        return parsed;
      }
    }
  }

  return null;
};

/**
 * Read the orchestrator registry resource and resolve the BITS MCP endpoint.
 */
const resolveBitsEndpointFromRegistry = async (
  orchestratorServer: Tool.Mcp,
  accessToken?: string,
): Promise<string | null> => {
  if (!orchestratorServer.server_url) {
    return null;
  }

  const { client, transport } = await connectBitsClient(orchestratorServer.server_url, accessToken);
  try {
    const resource = await client.readResource({ uri: ORCHESTRATOR_REGISTRY_URI });
    const contents = (resource as { contents?: Array<{ text?: string }> }).contents;
    if (!Array.isArray(contents)) {
      return null;
    }

    for (const entry of contents) {
      if (!entry || typeof entry.text !== "string") continue;
      const registry = tryParseJson(entry.text);
      const servers = registry?.mcp_servers;
      if (!Array.isArray(servers)) continue;

      for (const candidate of servers) {
        if (!candidate || typeof candidate !== "object") continue;
        const item = candidate as Record<string, unknown>;
        const id = typeof item.id === "string" ? item.id.toLowerCase() : "";
        const categories = Array.isArray(item.categories)
          ? item.categories.map((c) => String(c).toLowerCase())
          : [];
        const matchesBits =
          id === "bits_mcp" ||
          id.includes("bits") ||
          categories.some((c) => c.includes("bits") || c.includes("business-request"));
        if (matchesBits && typeof item.endpoint === "string" && item.endpoint.trim()) {
          return item.endpoint.trim();
        }
      }
    }
  } finally {
    await transport.close().catch(() => undefined);
  }

  return null;
};

/**
 * Resolve the BITS MCP endpoint from configured servers or the orchestrator registry.
 */
const resolveBitsEndpoint = async (
  servers: Tool.Mcp[],
  accessToken?: string,
): Promise<string> => {
  const configured = servers.find(looksLikeBitsServer);
  if (configured?.server_url) {
    return configured.server_url;
  }

  const orchestrator = servers.find(isOrchestratorServer);
  if (orchestrator) {
    const fromRegistry = await resolveBitsEndpointFromRegistry(orchestrator, accessToken);
    if (fromRegistry) {
      return fromRegistry;
    }
  }

  throw new Error("Unable to resolve BITS MCP server endpoint from configured servers or orchestrator registry.");
};

export interface GetBusinessRequestOptions {
  servers: Tool.Mcp[];
  accessToken?: string;
}

/**
 * Fetch Business Request information for a single BR number via the BITS MCP server.
 *
 * Accepts UI-facing BR variants (e.g. "BR-1234", "#1234") and normalizes to digits.
 * Returns the raw `{ br, metadata }` payload so callers can transform records.
 */
export const getBusinessRequest = async (
  br: string,
  { servers, accessToken }: GetBusinessRequestOptions,
): Promise<BusinessRequestLookupResult> => {
  // Accept UI-facing BR variants but call the tool with digits only.
  const normalizedBr = String(br).trim().replace(/^#?BR[-\s]?/i, "");
  const brNumberMatch = normalizedBr.match(/\d+/);
  if (!brNumberMatch) {
    throw new Error("BR must be all numbers.");
  }
  const normalizedBrNumber = brNumberMatch[0];

  const endpoint = await resolveBitsEndpoint(servers, accessToken);
  const { client, transport } = await connectBitsClient(endpoint, accessToken);

  try {
    const toolResult = await client.callTool({
      name: BITS_TOOL_NAME,
      arguments: {
        br_numbers: [Number(normalizedBrNumber)],
      },
    });

    const payload = extractPayload(toolResult);
    if (!payload) {
      throw new Error("BITS MCP returned an unrecognized response payload.");
    }

    const brRecords = Array.isArray(payload.br) ? (payload.br as Array<Record<string, unknown>>) : [];
    const metadata =
      payload.metadata && typeof payload.metadata === "object"
        ? (payload.metadata as Record<string, unknown>)
        : undefined;

    return { br: brRecords, metadata };
  } finally {
    await transport.close().catch(() => undefined);
  }
};
