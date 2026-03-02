import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Tool } from "openai/resources/responses/responses.mjs";
import type {
  Message,
  OrchestratorInsights,
  OrchestratorRecommendation,
} from "../store/slices/chatSlice";

const CATEGORY_GENERIC = "generic";

const MAX_CONTEXT_MESSAGES = 8;

const ORCHESTRATOR_CLIENT_NAME = "ssc-playground-orchestrator-client";
const ORCHESTRATOR_CLIENT_VERSION = "1.0.0";

const isLocalHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
};

const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

const normalizeRecommendations = (raw: unknown): OrchestratorRecommendation[] => {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((entry) => {
      if (!entry || typeof entry !== "object") return null;
      const value = entry as Record<string, unknown>;
      const idValue = value.mcp_server_id;
      if (typeof idValue !== "string" || idValue.trim().length === 0) return null;

      return {
        mcp_server_id: idValue,
        endpoint: typeof value.endpoint === "string" ? value.endpoint : undefined,
        category: typeof value.category === "string" ? value.category : undefined,
        confidence: typeof value.confidence === "number" ? value.confidence : undefined,
        matched_keywords: Array.isArray(value.matched_keywords)
          ? value.matched_keywords.filter((keyword): keyword is string => typeof keyword === "string")
          : undefined,
        classification_method:
          typeof value.classification_method === "string" ? value.classification_method : undefined,
        rationale: typeof value.rationale === "string" ? value.rationale : undefined,
      } as OrchestratorRecommendation;
    })
    .filter((entry): entry is OrchestratorRecommendation => Boolean(entry));
};

/**
 * Parse tool text into an object using increasingly permissive strategies.
 *
 * Some MCP servers return strict JSON, others return markdown fenced JSON,
 * and legacy servers may include explanatory prose around a JSON object.
 */
const tryParseJson = (value: string): Record<string, unknown> | null => {
  if (!value) return null;

  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === "object") {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // no-op
  }

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) {
    try {
      const parsed = JSON.parse(fenced[1]);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const candidate = trimmed.slice(start, end + 1);
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // no-op
    }
  }

  return null;
};

/**
 * Enforce transport and path constraints expected by MCP streamable HTTP.
 *
 * - Requires `https://` except local development (`http://localhost|127.0.0.1`).
 * - Rejects SSE endpoints.
 * - Normalizes endpoint path to end with `/mcp`.
 */
const normalizeHttpsMcpUrl = (rawServerUrl: string): URL => {
  const normalized = rawServerUrl.trim();
  const parsed = new URL(normalized);

  const allowInsecureLocal = import.meta.env.DEV && isLocalHost(parsed.hostname) && parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !allowInsecureLocal) {
    throw new Error(`Orchestrator MCP endpoint must use https:// transport (http:// allowed only for local development). Received: ${normalized}`);
  }

  if (parsed.pathname.endsWith("/sse")) {
    throw new Error(`SSE transport is not supported. Configure MCP streamable HTTP endpoint (/mcp): ${normalized}`);
  }

  if (!parsed.pathname.endsWith("/mcp")) {
    const trimmedPath = parsed.pathname.replace(/\/$/, "");
    parsed.pathname = `${trimmedPath}/mcp`;
  }

  return parsed;
};

/**
 * Extract structured payload from MCP tool responses across different shapes.
 */
const extractToolPayload = (toolResult: unknown): Record<string, unknown> | null => {
  if (!toolResult || typeof toolResult !== "object") {
    return null;
  }

  const result = toolResult as Record<string, unknown>;
  const structured = result.structuredContent;
  if (structured && typeof structured === "object" && !Array.isArray(structured)) {
    return structured as Record<string, unknown>;
  }

  const content = result.content;
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

const connectOrchestratorClient = async (serverUrl: string): Promise<{
  client: Client;
  transport: StreamableHTTPClientTransport;
  transportKind: "streamable-http";
}> => {
  const mcpUrl = normalizeHttpsMcpUrl(serverUrl);
  const client = new Client({
    name: ORCHESTRATOR_CLIENT_NAME,
    version: ORCHESTRATOR_CLIENT_VERSION,
  });
  const transport = new StreamableHTTPClientTransport(mcpUrl);
  await client.connect(transport);
  return { client, transport, transportKind: "streamable-http" };
};

const sanitizeServerId = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown_mcp";
};

const isAllowedRecommendedEndpoint = (rawEndpoint: string): boolean => {
  try {
    const parsed = new URL(rawEndpoint.trim());
    const host = parsed.hostname.toLowerCase();
    const path = parsed.pathname.toLowerCase();

    const isLocalHttp = import.meta.env.DEV && parsed.protocol === "http:" && isLocalHost(host);
    const isHttps = parsed.protocol === "https:";
    if (!isHttps && !isLocalHttp) {
      return false;
    }

    if (!path.endsWith("/mcp")) {
      return false;
    }

    if (host.endsWith(".example.com") || host === "example.com") {
      return false;
    }

    return true;
  } catch {
    return false;
  }
};

const dedupeServers = (servers: Tool.Mcp[]): Tool.Mcp[] => {
  const seen = new Set<string>();
  return servers.filter((server) => {
    const key = `${server.server_url}|${server.server_label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const normalizeEndpointForMatch = (endpoint?: string): string => {
  if (!endpoint) return "";
  try {
    const parsed = new URL(endpoint.trim());
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.protocol.toLowerCase()}//${parsed.host.toLowerCase()}${path}`;
  } catch {
    return endpoint.trim().replace(/\/+$/, "").toLowerCase();
  }
};

export const resolveServersFromInsights = (
  insights: OrchestratorInsights | null,
  servers: Tool.Mcp[],
): Tool.Mcp[] => {
  // Never route the final completion call back into the orchestrator itself.
  const downstreamServers = servers.filter((server) => !isOrchestratorServer(server));

  if (!insights || insights.recommendations.length === 0) {
    return [];
  }

  const byEndpoint = new Map<string, Tool.Mcp>();
  const byId = new Map<string, Tool.Mcp>();

  downstreamServers.forEach((server) => {
    if (server.server_url) {
      byEndpoint.set(normalizeEndpointForMatch(server.server_url), server);
    }
    byId.set(sanitizeServerId(server.server_label || server.server_url || "mcp"), server);
  });

  const recommended: Tool.Mcp[] = [];
  insights.recommendations.forEach((recommendation) => {
    // Prefer exact endpoint matches against already configured servers.
    const endpoint = recommendation.endpoint?.trim();
    const normalizedEndpoint = normalizeEndpointForMatch(endpoint);
    if (normalizedEndpoint && byEndpoint.has(normalizedEndpoint)) {
      recommended.push(byEndpoint.get(normalizedEndpoint)!);
      return;
    }

    const byServerId = byId.get(sanitizeServerId(recommendation.mcp_server_id));
    if (byServerId) {
      recommended.push(byServerId);
      return;
    }

    // Last resort: materialize a safe ad-hoc MCP server from recommendation payload.
    if (endpoint && isAllowedRecommendedEndpoint(endpoint)) {
      recommended.push({
        type: "mcp",
        server_url: endpoint,
        server_label: recommendation.mcp_server_id,
        server_description:
          recommendation.rationale ||
          `Recommended by orchestrator for category ${recommendation.category || CATEGORY_GENERIC}.`,
        require_approval: "never",
      });
    }
  });

  if (recommended.length === 0) {
    return [];
  }

  return dedupeServers(recommended);
};

interface OrchestratorInsightsRequest {
  messages: Message[];
  currentContent: string;
  servers: Tool.Mcp[];
  onProgress?: (event: OrchestratorProgressEvent) => void;
}

type OrchestratorProgressStatus =
  | "connecting"
  | "connected"
  | "classifying"
  | "routing"
  | "done"
  | "error";

export interface OrchestratorProgressEvent {
  status: OrchestratorProgressStatus;
  message: string;
  timestamp: string;
  transport?: "streamable-http";
}

interface OrchestratorClientConnection {
  client: Client;
  transport: StreamableHTTPClientTransport;
  transportKind: "streamable-http";
}

const orchestratorConnections = new Map<string, Promise<OrchestratorClientConnection>>();
const lastProgressByHandler = new WeakMap<
  (event: OrchestratorProgressEvent) => void,
  string
>();

const progressFingerprint = (event: Omit<OrchestratorProgressEvent, "timestamp">): string => {
  return `${event.status}|${event.message}|${event.transport || ""}`;
};

const emitProgress = (
  onProgress: ((event: OrchestratorProgressEvent) => void) | undefined,
  event: Omit<OrchestratorProgressEvent, "timestamp">
): void => {
  if (!onProgress) return;

  const signature = progressFingerprint(event);
  const previous = lastProgressByHandler.get(onProgress);
  if (previous === signature) {
    return;
  }
  lastProgressByHandler.set(onProgress, signature);

  onProgress({
    ...event,
    timestamp: new Date().toISOString(),
  });
};

const invalidateOrchestratorConnection = (serverUrl: string): void => {
  let key: string;
  try {
    key = normalizeHttpsMcpUrl(serverUrl).toString();
  } catch {
    return;
  }

  const existingPromise = orchestratorConnections.get(key);
  if (!existingPromise) return;

  orchestratorConnections.delete(key);
  existingPromise
    .then(({ transport }) => transport.close())
    .catch(() => undefined);
};

const getOrchestratorConnection = async (
  serverUrl: string,
  onProgress?: (event: OrchestratorProgressEvent) => void
): Promise<OrchestratorClientConnection> => {
  // Connection promises are memoized to avoid parallel handshakes for one URL.
  const mcpUrl = normalizeHttpsMcpUrl(serverUrl);
  const key = mcpUrl.toString();
  const existing = orchestratorConnections.get(key);
  if (existing) {
    return existing;
  }

  emitProgress(onProgress, {
    status: "connecting",
    message: `Connecting to orchestrator at ${mcpUrl.host}`,
  });

  const connectionPromise = (async () => {
    const connection = await connectOrchestratorClient(mcpUrl.toString());
    emitProgress(onProgress, {
      status: "connected",
      message: "Orchestrator connection established",
      transport: connection.transportKind,
    });
    return connection;
  })();

  orchestratorConnections.set(key, connectionPromise);

  try {
    return await connectionPromise;
  } catch (error) {
    orchestratorConnections.delete(key);
    throw error;
  }
};

export const getOrchestratorInsights = async ({
  messages,
  currentContent,
  servers,
  onProgress,
}: OrchestratorInsightsRequest): Promise<OrchestratorInsights | null> => {
  /**
   * Query orchestrator classification/routing and normalize result for UI state.
   *
   * The function first attempts `classify_and_suggest` for single-pass routing,
   * then falls back to legacy `classify_context` + `suggest_route` if needed.
   */
  const orchestratorServer = servers.find(isOrchestratorServer);
  if (!orchestratorServer) {
    return null;
  }

  const recent = messages.slice(-MAX_CONTEXT_MESSAGES);
  const contextMessages = recent.map((message) => ({
    role: message.role,
    content: message.content,
  }));

  const trimmedCurrentContent = currentContent.trim();
  if (trimmedCurrentContent.length > 0) {
    contextMessages.push({
      role: "user",
      content: trimmedCurrentContent,
    });
  }

  try {
    if (!orchestratorServer.server_url) {
      return null;
    }

    const { client, transportKind } = await getOrchestratorConnection(
      orchestratorServer.server_url,
      onProgress
    );

    emitProgress(onProgress, {
      status: "classifying",
      message: "Classifying and routing request",
      transport: transportKind,
    });

    let classifyPayload: Record<string, unknown> | null = null;
    let suggestPayload: Record<string, unknown> | null = null;

    try {
      // Preferred API: one call that returns both category and routing decisions.
      const combinedResult = await client.callTool({
        name: "classify_and_suggest",
        arguments: {
          messages: contextMessages,
          max_recommendations: 3,
          require_single_best: false,
        },
      });

      const combinedPayload = extractToolPayload(combinedResult);
      classifyPayload = combinedPayload;
      suggestPayload = combinedPayload;
    } catch {
      // Backward-compatible fallback for orchestrators that expose older tools only.
      emitProgress(onProgress, {
        status: "routing",
        message: "Using legacy routing flow",
        transport: transportKind,
      });

      const classifyResult = await client.callTool({
        name: "classify_context",
        arguments: {
          messages: contextMessages,
        },
      });

      const suggestResult = await client.callTool({
        name: "suggest_route",
        arguments: {
          messages: contextMessages,
          max_recommendations: 3,
          require_single_best: false,
        },
      });

      classifyPayload = extractToolPayload(classifyResult);
      suggestPayload = extractToolPayload(suggestResult);
    }

    if (!suggestPayload) {
      emitProgress(onProgress, {
        status: "error",
        message: "Orchestrator returned an empty routing payload",
        transport: transportKind,
      });
      return null;
    }

    const categories = Array.isArray(classifyPayload?.categories)
      ? classifyPayload?.categories
      : [];

    const topCategory = categories.find(
      (entry) =>
        entry &&
        typeof entry === "object" &&
        typeof (entry as Record<string, unknown>).name === "string" &&
        ((entry as Record<string, unknown>).name as string).trim().length > 0
    ) as Record<string, unknown> | undefined;

    const recommendations = normalizeRecommendations(suggestPayload.recommendations);
    const responseClassificationMethod =
      typeof suggestPayload.classification_method === "string"
        ? suggestPayload.classification_method
        : undefined;
    const fallback = suggestPayload.fallback as Record<string, unknown> | undefined;
    const fallbackCategory =
      typeof fallback?.category === "string" && fallback.category.trim().length > 0
        ? fallback.category
        : undefined;
    const fallbackUpstream =
      fallback && Object.prototype.hasOwnProperty.call(fallback, "upstream")
        ? typeof fallback.upstream === "string" && fallback.upstream.trim().length > 0
          ? fallback.upstream
          : null
        : undefined;
    const effectiveRecommendations = fallbackUpstream === null ? [] : recommendations;

    const category =
      // Resolve category using strongest available signal in priority order.
      (typeof topCategory?.name === "string" ? topCategory.name : undefined) ||
      effectiveRecommendations[0]?.category ||
      fallbackCategory ||
      CATEGORY_GENERIC;
    const fallbackReason =
      typeof fallback?.reason === "string" && fallback.reason.trim().length > 0
        ? fallback.reason
        : undefined;

    emitProgress(onProgress, {
      status: "done",
      message: "Orchestrator routing completed",
      transport: transportKind,
    });

    return {
      category,
      recommendations: effectiveRecommendations,
      classificationMethod:
        responseClassificationMethod || effectiveRecommendations[0]?.classification_method,
      fallbackReason,
      fallbackUpstream,
      source: "orchestrator",
      transport: transportKind,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("Orchestrator call failed", error);
    if (orchestratorServer.server_url) {
      invalidateOrchestratorConnection(orchestratorServer.server_url);
    }
    emitProgress(onProgress, {
      status: "error",
      message: "Unable to reach orchestrator. Falling back.",
    });
    return null;
  }
};
