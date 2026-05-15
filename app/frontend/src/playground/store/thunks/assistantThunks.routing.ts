/**
 * Orchestrator routing coordinator.
 *
 * Computes server routing from orchestrator insights and produces a stable
 * UI snapshot (progress + final insights + selected servers).
 */
import { Message, OrchestratorInsights } from "../slices/chatSlice";
import { Tool } from "openai/resources/responses/responses.mjs";
import {
  getOrchestratorInsights,
  OrchestratorProgressEvent,
  resolveServersFromInsights,
} from "../../services/orchestratorService";
import {
  buildOrchestratorProgressInsights,
  dedupeMcpServers,
  isDuplicateProgressUpdate,
  isOrchestratorServer,
  MAX_ORCHESTRATOR_PROGRESS_UPDATES,
} from "./assistantThunksHelpers";

type ResolveOrchestratorRoutingArgs = {
  messages: Message[];
  currentContent: string;
  mcpServers: Tool.Mcp[];
  accessToken: string;
  onProgressInsights: (insights: OrchestratorInsights) => void;
};

export type OrchestratorRoutingResolution = {
  hasOrchestratorServer: boolean;
  serversWithAuth: Tool.Mcp[];
  routedServers: Tool.Mcp[];
  orchestratorInsights: Awaited<ReturnType<typeof getOrchestratorInsights>>;
  progressUpdates: OrchestratorProgressEvent[];
  insightsWithSelection: OrchestratorInsights | null;
};

/**
 * Resolve orchestrator routing and produce a final insights snapshot for UI state.
 */
export const resolveOrchestratorRouting = async ({
  messages,
  currentContent,
  mcpServers,
  accessToken,
  onProgressInsights,
}: ResolveOrchestratorRoutingArgs): Promise<OrchestratorRoutingResolution> => {
  // Step 1: Attach auth to every configured server so downstream calls can execute.
  const serversWithAuth: Tool.Mcp[] = (mcpServers || []).map((server: Tool.Mcp) => ({
    ...server,
    authorization: accessToken,
  }));

  const hasOrchestratorServer = serversWithAuth.some(isOrchestratorServer);
  const progressUpdates: OrchestratorProgressEvent[] = [];

  // Step 2: Ask orchestrator for route recommendations while emitting progress snapshots.
  const orchestratorInsights = hasOrchestratorServer
    ? await getOrchestratorInsights({
        messages,
        currentContent,
        servers: serversWithAuth,
        accessToken,
        onProgress: (event: OrchestratorProgressEvent) => {
          if (isDuplicateProgressUpdate(progressUpdates[progressUpdates.length - 1], event)) {
            return;
          }
          progressUpdates.push(event);
          if (progressUpdates.length > MAX_ORCHESTRATOR_PROGRESS_UPDATES) {
            progressUpdates.shift();
          }
          onProgressInsights(buildOrchestratorProgressInsights(event, progressUpdates.slice()));
        },
      })
    : null;

  const orchestratorUnavailable = !orchestratorInsights;
  const downstreamServers = serversWithAuth.filter((server) => !isOrchestratorServer(server));

  const orchestratorRecommendedServers = orchestratorUnavailable
    ? []
    : resolveServersFromInsights(orchestratorInsights, serversWithAuth);

  // Step 3: Resolve the actual routed server set with deterministic fallback rules.
  const routedServers = orchestratorUnavailable
    ? dedupeMcpServers(downstreamServers)
    : orchestratorRecommendedServers.length > 0
      ? dedupeMcpServers(orchestratorRecommendedServers)
      : [];

  const finalProgress = progressUpdates[progressUpdates.length - 1];

  // Step 4: Build a final insights snapshot that the UI can persist and render.
  const baseInsights = orchestratorInsights
    ? {
        ...orchestratorInsights,
        status: finalProgress?.status || "done",
        statusMessage:
          finalProgress?.message
          || (orchestratorInsights.fallbackReason
            ? "Completed with fallback"
            : "Orchestrator routing completed"),
        progressUpdates: progressUpdates.slice(),
      }
    : hasOrchestratorServer
      ? {
          category: "general",
          recommendations: [],
          source: "orchestrator" as const,
          status: "error" as const,
          statusMessage: finalProgress?.message || "Orchestrator unavailable",
          progressUpdates: progressUpdates.slice(),
          timestamp: finalProgress?.timestamp || new Date().toISOString(),
          error: "orchestrator_unavailable",
        }
      : null;

  const insightsWithSelection = baseInsights && orchestratorRecommendedServers.length > 0
    ? {
        ...baseInsights,
        selectedServers: orchestratorRecommendedServers.map((server) => ({
          server_label: server.server_label,
          server_url: server.server_url || "(no-url)",
        })),
      }
    : baseInsights;

  return {
    hasOrchestratorServer,
    serversWithAuth,
    routedServers,
    orchestratorInsights,
    progressUpdates,
    insightsWithSelection,
  };
};
