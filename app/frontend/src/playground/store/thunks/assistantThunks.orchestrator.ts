/**
 * Orchestrator utility helpers.
 *
 * Contains pure helpers for preflight payload parsing, model resolution,
 * insights shaping, and orchestrator server identification.
 */
import {
  MessageMcpAttribution,
  OrchestratorInsights,
} from "../slices/chatSlice";
import { CompletionMessage } from "../../services/completionService";
import { Tool } from "openai/resources/responses/responses.mjs";
import {
  OrchestratorProgressEvent,
} from "../../services/orchestratorService";
import type { RootState } from "..";

export type PreflightRecommendation = {
  category?: string;
  mcp_server_id?: string;
};

export const MAX_ORCHESTRATOR_PROGRESS_UPDATES = 20;

/**
 * Convert orchestrator preflight output into a compact routing summary.
 */
export const buildPreflightRoutingContextMessage = (routing: unknown): string => {
  const routingRecord = routing as {
    recommendations?: PreflightRecommendation[];
    fallback?: { category?: string };
  };

  const recommendations = Array.isArray(routingRecord?.recommendations)
    ? routingRecord.recommendations
        .filter((entry): entry is PreflightRecommendation => Boolean(entry && typeof entry === "object"))
    : [];

  const categories = Array.from(new Set(
    recommendations
      .map((entry) => (typeof entry.category === "string" ? entry.category.trim() : ""))
      .filter((value) => value.length > 0),
  ));

  const serverIds = recommendations
    .map((entry) => (typeof entry.mcp_server_id === "string" ? entry.mcp_server_id.trim() : ""))
    .filter((value) => value.length > 0);

  const fallbackCategory =
    typeof routingRecord?.fallback?.category === "string"
      ? routingRecord.fallback.category.trim()
      : "";

  const categorySummary = categories.length > 0
    ? categories.join(", ")
    : fallbackCategory || "general";
  const serverSummary = serverIds.length > 0 ? serverIds.join(", ") : "none";

  return `Orchestrator preflight routing summary: categories='${categorySummary}', servers='${serverSummary}'. Use this as routing context.`;
};

export const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

export const buildMessageMcpAttribution = (
  routedServers: Tool.Mcp[],
  insights: Pick<OrchestratorInsights, "category" | "status" | "statusMessage"> | null,
): MessageMcpAttribution | undefined => {
  // Attribution is emitted only when at least one MCP server is actively routed.
  if (routedServers.length === 0) {
    return undefined;
  }

  return {
    source: "live",
    generatedAt: new Date().toISOString(),
    category: insights?.category,
    status: insights?.status,
    statusMessage: insights?.statusMessage,
    servers: routedServers.map((server) => ({
      serverLabel: String(server.server_label || server.server_url || "MCP server"),
      serverUrl: server.server_url,
    })),
  };
};

export const isDuplicateProgressUpdate = (
  previous: OrchestratorProgressEvent | undefined,
  next: OrchestratorProgressEvent,
): boolean => {
  if (!previous) return false;
  return (
    previous.status === next.status
    && previous.message === next.message
    && previous.transport === next.transport
  );
};

export const buildOrchestratorProgressInsights = (
  event: OrchestratorProgressEvent,
  progressUpdates: OrchestratorProgressEvent[],
): OrchestratorInsights => ({
  category: "routing",
  recommendations: [],
  source: "orchestrator",
  transport: event.transport,
  status: event.status,
  statusMessage: event.message,
  progressUpdates,
  timestamp: event.timestamp,
});

export const shouldUseOrchestratorPreflight = (): boolean => {
  return import.meta.env.VITE_PLAYGROUND_ORCHESTRATOR_PREFLIGHT !== "false";
};

export const resolveCompletionModel = (state: RootState): string => {
  // Priority: env override > user-selected model > safe default.
  const selectedModel = String(state.models?.selectedModel || "").trim();

  const configuredLiteLLMModel = String(import.meta.env.VITE_LITELLM_MODEL || "").trim();
  if (configuredLiteLLMModel) {
    return configuredLiteLLMModel;
  }

  if (selectedModel) {
    if (["gpt-3.5", "gpt-4", "gpt-4-turbo"].includes(selectedModel)) {
      return "gpt-4o";
    }
    return selectedModel;
  }

  return "gpt-4o";
};

export const findOrchestratorServer = (servers: Tool.Mcp[]): Tool.Mcp | undefined => {
  return servers.find((server) => {
    const label = String(server.server_label || "").toLowerCase();
    const description = String(server.server_description || "").toLowerCase();
    return label.includes("orchestrator") || description.includes("orchestrator");
  });
};

export const toOrchestratorPreflightUrl = (serverUrl: string): string => {
  const trimmed = serverUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/mcp")) {
    return `${trimmed.slice(0, -4)}/orchestrator/suggest-route`;
  }
  return `${trimmed}/orchestrator/suggest-route`;
};

export const extractLastUserText = (messages: CompletionMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    const textParts = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    if (textParts.trim()) {
      return textParts;
    }
  }
  return "";
};
