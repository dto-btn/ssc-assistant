/**
 * Orchestrator integration service for client-side pre-routing.
 *
 * Core responsibilities:
 * - Establish and reuse streamable-http MCP connections to orchestrator.
 * - Normalize mixed orchestrator payload shapes into typed routing insights.
 * - Resolve recommendations into concrete downstream MCP server entries.
 * - Preserve backward compatibility via legacy classify/suggest fallback.
 */

import { Tool } from "openai/resources/responses/responses.mjs";
import type {
  Message,
  OrchestratorInsights,
  OrchestratorRecommendation,
} from "../store/slices/chatSlice";

const CATEGORY_GENERIC = "general";

const MAX_CONTEXT_MESSAGES = 8;

// Same-origin API route; server.js proxies /api/* to the Flask backend (adds X-API-Key),
// which forwards to the orchestrator with server-side credentials.
const ORCHESTRATOR_SUGGEST_ROUTE_PATH = "/api/playground/orchestrator/suggest-route";

/**
 * Return whether the host is one of the allowed local development loopbacks.
 */
const isLocalHost = (host: string): boolean => {
  const normalized = host.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
};

/**
 * Detect whether an MCP server entry is the orchestrator itself.
 */
const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

/**
 * Normalize category names for consistent downstream comparisons.
 */
const normalizeCategory = (value?: string): string | undefined => {
  if (!value) return undefined;
  const normalized = value.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized === "generic" ? "general" : normalized;
};

/**
 * Coerce raw orchestrator recommendation payloads into typed objects.
 */
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
        category: typeof value.category === "string" ? normalizeCategory(value.category) : undefined,
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
 * Enforce transport and path constraints expected by MCP streamable HTTP.
 *
 * - Requires `https://` except local development (`http://localhost|127.0.0.1`).
 * - Rejects SSE endpoints.
 * - Normalizes endpoint path to end with `/mcp`.
 */
export const normalizeHttpsMcpUrl = (rawServerUrl: string): URL => {
  const normalized = rawServerUrl.trim();
  const parsed = new URL(normalized);

  const allowInsecureLocal = import.meta.env.DEV && isLocalHost(parsed.hostname) && parsed.protocol === "http:";
  if (parsed.protocol !== "https:" && !allowInsecureLocal) {
    throw new Error(`Orchestrator MCP endpoint must use https:// transport (http:// allowed only for local development). Received: ${normalized}`);
  }

  if (parsed.pathname.endsWith("/sse")) {
    throw new Error(`SSE transport is not supported. Configure MCP streamable HTTP endpoint (/mcp): ${normalized}`);
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  if (!normalizedPath.endsWith("/mcp")) {
    parsed.pathname = `${normalizedPath}/mcp`;
  } else {
    parsed.pathname = normalizedPath || "/";
  }

  return parsed;
};

/**
 * Convert arbitrary server IDs into a deterministic matching key.
 */
const sanitizeServerId = (value: string): string => {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "unknown_mcp";
};

/**
 * Validate ad-hoc recommended endpoints before adding them to tool routing.
 */
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

/**
 * Remove duplicate MCP servers based on URL + label identity.
 */
const dedupeServers = (servers: Tool.Mcp[]): Tool.Mcp[] => {
  const seen = new Set<string>();
  return servers.filter((server) => {
    const key = `${server.server_url}|${server.server_label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/**
 * Canonicalize endpoints so recommendations can be matched reliably.
 */
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

/**
 * Resolve orchestrator recommendations into concrete downstream MCP servers.
 */
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
  accessToken?: string;
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

const lastProgressByHandler = new WeakMap<
  (event: OrchestratorProgressEvent) => void,
  string
>();

/**
 * Build a stable signature used to suppress duplicate progress emissions.
 */
const progressFingerprint = (event: Omit<OrchestratorProgressEvent, "timestamp">): string => {
  return `${event.status}|${event.message}|${event.transport || ""}`;
};

/**
 * Emit progress updates while suppressing repeated equivalent events.
 */
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

export const getOrchestratorInsights = async ({
  messages,
  currentContent,
  servers,
  accessToken,
  onProgress,
}: OrchestratorInsightsRequest): Promise<OrchestratorInsights | null> => {
  /**
   * Query orchestrator routing, normalize payload shape, and return UI-ready insights.
   */
  // Query orchestrator classification/routing and normalize result for UI state.
  // The function first attempts `classify_and_suggest`, then falls back to
  // legacy `classify_context` + `suggest_route` when required.
  //
  // The final payload intentionally captures both route choices and fallback
  // reasoning so the chat thunk can decide whether to call tools or continue
  // model-only without losing debuggability.
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

    const transportKind: "streamable-http" | undefined = undefined;

    emitProgress(onProgress, {
      status: "classifying",
      message: "Classifying and routing request",
      transport: transportKind,
    });

    let classifyPayload: Record<string, unknown> | null = null;
    let suggestPayload: Record<string, unknown> | null = null;

    // Route through the API backend so the browser never contacts the orchestrator directly.
    const response = await fetch(ORCHESTRATOR_SUGGEST_ROUTE_PATH, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({
        messages: contextMessages,
        max_recommendations: 3,
        require_single_best: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`Orchestrator route request failed with status ${response.status}`);
    }

    const routePayload = (await response.json()) as Record<string, unknown>;
    classifyPayload = routePayload;
    suggestPayload = routePayload;

    if (!suggestPayload) {
      emitProgress(onProgress, {
        status: "done",
        message: "Orchestrator returned no routing data; continuing without downstream routing",
        transport: transportKind,
      });
      return {
        category: CATEGORY_GENERIC,
        recommendations: [],
        classificationMethod: undefined,
        fallbackReason: "Orchestrator returned no routing data.",
        fallbackUpstream: null,
        source: "orchestrator",
        transport: transportKind,
        timestamp: new Date().toISOString(),
        error: "empty_routing_payload",
      };
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
    const fallbackCategory = normalizeCategory(
      typeof fallback?.category === "string" ? fallback.category : undefined
    );
    const fallbackUpstream =
      fallback && Object.prototype.hasOwnProperty.call(fallback, "upstream")
        ? typeof fallback.upstream === "string" && fallback.upstream.trim().length > 0
          ? fallback.upstream
          : null
        : undefined;
    // When upstream is explicitly null, orchestrator intentionally selected no MCP server.
    const effectiveRecommendations = fallbackUpstream === null ? [] : recommendations;

    const category =
      // Resolve category using strongest available signal in priority order.
      normalizeCategory(typeof topCategory?.name === "string" ? topCategory.name : undefined) ||
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
    emitProgress(onProgress, {
      status: "error",
      message: "Unable to reach orchestrator. Falling back.",
    });
    return null;
  }
};
