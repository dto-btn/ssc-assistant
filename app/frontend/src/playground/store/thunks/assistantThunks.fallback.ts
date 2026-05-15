/**
 * Tool-failure fallback side-effects.
 *
 * Applies the shared UI/state updates needed before retrying a completion
 * without MCP tools after a tool-enabled run fails.
 */
import { addToast } from "../slices/toastSlice";
import {
  setAssistantResponsePhase,
  setOrchestratorInsights,
  updateMessageContent,
} from "../slices/chatSlice";
import { Tool } from "openai/resources/responses/responses.mjs";
import { OrchestratorProgressEvent } from "../../services/orchestratorService";
import { RootState } from "..";
import {
  IS_DEV,
  isDuplicateProgressUpdate,
  MAX_ORCHESTRATOR_PROGRESS_UPDATES,
} from "./assistantThunksHelpers";

export const applyToolFailureFallback = ({
  toolEnabledError,
  routedServersWithAuth,
  abortController,
  dispatch,
  sessionId,
  orchestratorInsights,
  progressUpdates,
  getState,
  latestAssistantMessageId,
}: {
  toolEnabledError: unknown;
  routedServersWithAuth: Tool.Mcp[];
  abortController: AbortController;
  dispatch: any;
  sessionId: string;
  orchestratorInsights: { transport?: string } | null;
  progressUpdates: OrchestratorProgressEvent[];
  getState: () => RootState;
  latestAssistantMessageId: string;
}): void => {
  // If no tool route exists (or user already stopped), propagate original failure.
  if (routedServersWithAuth.length === 0 || abortController.signal.aborted) {
    throw toolEnabledError;
  }

  // Step 1: Notify user that we are retrying without tools.
  dispatch(
    addToast({
      message: "MCP tools were unavailable for this response, so the assistant retried without tools. Citations may be missing.",
      isError: false,
    })
  );

  const retryEvent: OrchestratorProgressEvent = {
    status: "routing",
    message: "Retried without tools after downstream tool failure",
    timestamp: new Date().toISOString(),
    transport: orchestratorInsights?.transport === "streamable-http" ? "streamable-http" : undefined,
  };

  // Step 2: Append retry progress while enforcing the same rolling cap as routing.
  if (!isDuplicateProgressUpdate(progressUpdates[progressUpdates.length - 1], retryEvent)) {
    progressUpdates.push(retryEvent);
    if (progressUpdates.length > MAX_ORCHESTRATOR_PROGRESS_UPDATES) {
      progressUpdates.shift();
    }
  }

  // Step 3: Patch existing orchestrator insights so UI reflects retry state.
  const existingInsights = getState().chat.orchestratorInsightsBySessionId?.[sessionId];
  if (existingInsights) {
    dispatch(
      setOrchestratorInsights({
        sessionId,
        insights: {
          ...existingInsights,
          status: retryEvent.status,
          statusMessage: retryEvent.message,
          progressUpdates: progressUpdates.slice(),
          timestamp: retryEvent.timestamp,
        },
      })
    );
  }

  if (IS_DEV) {
    console.warn("Tool-enabled completion failed; retrying without MCP tools.", toolEnabledError);
  }

  // Step 4: Reset assistant row and phase before fallback completion run.
  dispatch(updateMessageContent({ messageId: latestAssistantMessageId, content: "", citations: [] }));
  dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));
};
