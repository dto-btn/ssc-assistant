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
        rationale: typeof value.rationale === "string" ? value.rationale : undefined,
      } as OrchestratorRecommendation;
    })
    .filter((entry): entry is OrchestratorRecommendation => Boolean(entry));
};

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

const toDisplayLabel = (serverId: string): string => {
  return serverId
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase()) || "Recommended MCP";
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

export const resolveServersFromInsights = (
  insights: OrchestratorInsights | null,
  servers: Tool.Mcp[],
): Tool.Mcp[] => {
  const downstreamServers = servers.filter((server) => !isOrchestratorServer(server));

  if (!insights || insights.recommendations.length === 0) {
    return downstreamServers;
  }

  const byEndpoint = new Map<string, Tool.Mcp>();
  const byId = new Map<string, Tool.Mcp>();

  downstreamServers.forEach((server) => {
    if (server.server_url) {
      byEndpoint.set(server.server_url, server);
    }
    byId.set(sanitizeServerId(server.server_label || server.server_url || "mcp"), server);
  });

  const recommended: Tool.Mcp[] = [];
  insights.recommendations.forEach((recommendation) => {
    const endpoint = recommendation.endpoint?.trim();
    if (endpoint && byEndpoint.has(endpoint)) {
      recommended.push(byEndpoint.get(endpoint)!);
      return;
    }

    const byServerId = byId.get(sanitizeServerId(recommendation.mcp_server_id));
    if (byServerId) {
      recommended.push(byServerId);
      return;
    }

    if (endpoint) {
      recommended.push({
        type: "mcp",
        server_url: endpoint,
        server_label: toDisplayLabel(recommendation.mcp_server_id),
        server_description:
          recommendation.rationale ||
          `Recommended by orchestrator for category ${recommendation.category || CATEGORY_GENERIC}.`,
        require_approval: "never",
      });
    }
  });

  if (recommended.length === 0) {
    return downstreamServers;
  }

  return dedupeServers(recommended);
};

const detectCategoryFromText = (messages: Message[], currentContent: string): string => {
  const corpus = `${messages.map((message) => message.content).join(" ")} ${currentContent}`.toLowerCase();

  if (/\b(geds|employee directory|staff directory|annuaire)\b/.test(corpus)) return "geds";
  if (/\b(archibus|desk booking|room booking|workspace|workplace)\b/.test(corpus)) return "archibus";
  if (/\b(bits|business request|\bbr\b|change request)\b/.test(corpus)) return "bits";
  if (/\b(pmcoe|project charter|project management)\b/.test(corpus)) return "pmcoe";
  if (/\b(telecom|phone line|voip|mobile device|sim card)\b/.test(corpus)) return "telecom";
  if (/\b(corporate|intranet|hr policy|procurement|travel)\b/.test(corpus)) return "corporate";

  return CATEGORY_GENERIC;
};

const buildLocalFallback = async (
  messages: Message[],
  currentContent: string,
  servers: Tool.Mcp[],
  error?: string,
): Promise<OrchestratorInsights> => {
  const downstreamServers = servers.filter((server) => !isOrchestratorServer(server));
  const category = detectCategoryFromText(messages, currentContent);
  const suggested = downstreamServers
    .slice(0, 3)
    .map((server: Tool.Mcp) => ({
      mcp_server_id: sanitizeServerId(server.server_label || server.server_url || "mcp"),
      endpoint: server.server_url,
      category,
      confidence: undefined,
      matched_keywords: undefined,
      rationale: `Matched local category hints for ${category}.`,
    }));

  return {
    category: category || CATEGORY_GENERIC,
    recommendations: suggested,
    fallbackReason: "Orchestrator output unavailable. Used local category fallback.",
    source: "local-fallback",
    timestamp: new Date().toISOString(),
    error,
  };
};

interface OrchestratorInsightsRequest {
  messages: Message[];
  currentContent: string;
  servers: Tool.Mcp[];
}

export const getOrchestratorInsights = async ({
  messages,
  currentContent,
  servers,
}: OrchestratorInsightsRequest): Promise<OrchestratorInsights | null> => {
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
      return buildLocalFallback(messages, currentContent, servers, "Orchestrator server URL is missing.");
    }

    const { client, transport, transportKind } = await connectOrchestratorClient(orchestratorServer.server_url);

    try {
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

      const classifyPayload = extractToolPayload(classifyResult);
      const suggestPayload = extractToolPayload(suggestResult);

      if (!suggestPayload) {
        return buildLocalFallback(messages, currentContent, servers, "Invalid orchestrator suggest_route payload.");
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
      const category =
        (typeof topCategory?.name === "string" ? topCategory.name : undefined) ||
        recommendations[0]?.category ||
        CATEGORY_GENERIC;

      const fallback = suggestPayload.fallback as Record<string, unknown> | undefined;
      const fallbackReason =
        typeof fallback?.reason === "string" && fallback.reason.trim().length > 0
          ? fallback.reason
          : undefined;

      return {
        category,
        recommendations,
        fallbackReason,
        source: "orchestrator",
        transport: transportKind,
        timestamp: new Date().toISOString(),
      };
    } finally {
      await transport.close().catch(() => undefined);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown orchestrator error";
    return buildLocalFallback(messages, currentContent, servers, message);
  }
};
