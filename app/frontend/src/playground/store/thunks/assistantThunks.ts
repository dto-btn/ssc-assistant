/**
 * Assistant orchestration thunks.
 *
 * This file is the high-level pipeline for one user turn.
 *
 * Responsibility map:
 * - Routing classification and server selection: assistantThunks.routing
 * - Preflight context fetch: assistantThunks.preflight
 * - Completion/rewrite/reveal execution lifecycle: assistantThunks.execution
 * - Tool-failure retry side-effects: assistantThunks.fallback
 * - Shared utility exports grouped by domain: assistantThunksHelpers
 */
import {
  addMessage,
  deleteMessage,
  updateMessageContent,
  setSessionLoading,
  setAssistantResponsePhase,
  setOrchestratorInsights,
  setMessageAttribution,
  setMessageBrArtifacts,
  PlaygroundBrArtifacts,
} from "../slices/chatSlice";
import { setIsSessionNew, renameSession } from "../slices/sessionSlice";
import { addToast } from "../slices/toastSlice";
import {
  CompletionMessage,
  CompletionResult,
} from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";
import { AppThunk } from "..";
import type { RootState } from "..";
import i18n from "../../../i18n";

import { FileAttachment } from "../../types";
import { Tool } from "openai/resources/responses/responses.mjs";
import { selectMessagesForSession } from "../selectors/chatSelectors";
import { applyToolFailureFallback } from "./assistantThunks.fallback";
import { fetchPreflightRoutingContextMessage } from "./assistantThunks.preflight";
import { resolveOrchestratorRouting } from "./assistantThunks.routing";
import {
  createAssistantExecutionHelpers,
  ResolvedAssistantAnswer,
} from "./assistantThunks.execution";
import {
  BITS_NON_RESULT_TOOL_NAMES,
  BITS_TOOL_NAMES,
  buildCompletionMessagesForRun,
  buildMessageMcpAttribution,
  buildPlaygroundChartSystemMessage,
  CANONICAL_EPS_CITATION_FALLBACK,
  deriveSessionName,
  hasRequiredEpsLegacyCitations,
  isBrGuidancePrompt,
  isLikelyEpsCitationQuery,
  isLikelyPmcoeCitationQuery,
  mapMessagesForCompletion,
  mergeBitsArtifacts,
  mergeCitationsPreferConcreteUrls,
  parseBitsArtifactsFromToolOutput,
  resolveCompletionModel,
  selectCanonicalEpsCitations,
  shouldEnrichEpsCitations,
  shouldEnrichPmcoeCitations,
  stripSyntheticCitationsWhenConcreteExists,
} from "./assistantThunksHelpers";

export {
  deriveSessionName,
  hasRequiredEpsLegacyCitations,
  isLikelyEpsCitationQuery,
  isLikelyPmcoeCitationQuery,
  shouldEnrichEpsCitations,
  shouldEnrichPmcoeCitations,
};

/**
 * Per-session AbortControllers for in-flight streaming requests.
 * Stored outside Redux because AbortController instances are not serializable.
 */
const sessionAbortControllers = new Map<string, AbortController>();

export function stopAssistantMessage(sessionId: string): void {
  sessionAbortControllers.get(sessionId)?.abort();
}

export interface SendAssistantMessageArgs {
  sessionId: string;
  content: string;
  attachments?: FileAttachment[];
  provider?: "azure-openai" | "aws-bedrock";
  skipUserMessage?: boolean;
  deleteMessageId?: string;
}

export const sendAssistantMessage = ({
  sessionId,
  content,
  attachments,
  provider = "azure-openai",
  skipUserMessage = false,
  deleteMessageId,
}: SendAssistantMessageArgs): AppThunk<Promise<void>> => async (
  dispatch,
  getState
) => {
  // Step 1: Mark the session as actively generating and register abort support.
  dispatch(setSessionLoading({ sessionId, loading: true }));
  dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));
  const abortController = new AbortController();
  sessionAbortControllers.set(sessionId, abortController);

  let placeholderAssistantMessageId: string | undefined;
  try {
    // Step 2: Guard auth and initialize session metadata for first meaningful turn.
    const { accessToken } = getState().auth;
    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(addToast({ message: i18n.t("playground:auth.tokenExpired"), isError: true }));
      dispatch(setSessionLoading({ sessionId, loading: false }));
      return;
    }

    const isNewChat = getState().sessions.sessions.find((s) => s.id === sessionId)?.isNewChat;
    if (isNewChat) {
      const meaningfulText = content.trim().length > 0;
      const meaningfulTurn = meaningfulText || (attachments && attachments.length > 0);

      if (meaningfulText) {
        const autoName = deriveSessionName(content);
        if (autoName) {
          dispatch(renameSession({ id: sessionId, name: autoName }));
        }
      }

      if (meaningfulTurn) {
        dispatch(setIsSessionNew({ id: sessionId, isNew: false }));
      }
    }

    const { mcpServers } = getState().tools;
    const existingSessionMessages = selectMessagesForSession(getState(), sessionId);

    if (deleteMessageId) {
      dispatch(deleteMessage(deleteMessageId));
    }

    if (!skipUserMessage) {
      dispatch(addMessage({ sessionId, role: "user", content, attachments }));
    }

    dispatch(addMessage({ sessionId, role: "assistant", content: "" }));

    const placeholderAssistantMessages = selectMessagesForSession(getState(), sessionId).filter(
      (message) => message.role === "assistant"
    );
    const latestAssistantMessage = placeholderAssistantMessages[placeholderAssistantMessages.length - 1];

    if (!latestAssistantMessage) {
      throw new Error("Failed to create assistant message");
    }
    placeholderAssistantMessageId = latestAssistantMessage.id;

    // Step 3: Resolve orchestrator route and persist routing insights/attribution.
    const routingResolution = await resolveOrchestratorRouting({
      messages: existingSessionMessages,
      currentContent: content,
      mcpServers: mcpServers || [],
      accessToken,
      onProgressInsights: (insights) => {
        dispatch(setOrchestratorInsights({ sessionId, insights }));
      },
    });

    const {
      hasOrchestratorServer,
      insightsWithSelection,
      orchestratorInsights,
      progressUpdates,
      routedServers,
      serversWithAuth,
    } = routingResolution;

    if (!hasOrchestratorServer) {
      dispatch(
        addToast({
          message: "Orchestrator MCP is not configured; routing will fall back to available MCP servers.",
          isError: false,
        })
      );
    }

    const assistantMcpAttribution = buildMessageMcpAttribution(routedServers, insightsWithSelection);

    dispatch(setOrchestratorInsights({ sessionId, insights: insightsWithSelection }));

    if (assistantMcpAttribution) {
      dispatch(
        setMessageAttribution({
          messageId: latestAssistantMessage.id,
          attribution: assistantMcpAttribution,
        })
      );
    }

    const updatedSessionMessages = selectMessagesForSession(getState(), sessionId).filter(
      (message) => message.id !== latestAssistantMessage.id
    );

    // Step 4: Build completion context, including attachment hydration.
    const completionMessages = await mapMessagesForCompletion(updatedSessionMessages, dispatch as any, getState);

    const routedServersWithAuth: Tool.Mcp[] = routedServers.map((server) => ({
      ...server,
      authorization: (server as Tool.Mcp & { authorization?: string }).authorization || accessToken,
    }));

    const baseCompletionMessages = [
      buildPlaygroundChartSystemMessage(),
      ...completionMessages,
    ];
    // Optional preflight adds a compact route summary as a system hint.
    const preflightRoutingContextMessage = await fetchPreflightRoutingContextMessage({
      completionMessages,
      serversWithAuth,
      accessToken,
    });

    const buildMessagesForRun = (serversForRun: Tool.Mcp[]): CompletionMessage[] => {
      return buildCompletionMessagesForRun({
        baseMessages: baseCompletionMessages,
        routedServers: serversForRun,
        preflightRoutingContextMessage,
        userPrompt: content,
      });
    };

    const completionModel = resolveCompletionModel(getState() as RootState);

    // Step 5: Build execution helpers for streaming, rewrites, and retries.
    const {
      harvestStandaloneCitations,
      maybeRewriteAnswerWithCitations,
      revealAssistantAnswer,
      runCompletion,
    } = createAssistantExecutionHelpers({
      sessionId,
      latestAssistantMessageId: latestAssistantMessage.id,
      content,
      completionModel,
      provider,
      accessToken,
      abortController,
      dispatch,
    });

    let completionResult: CompletionResult | undefined;
    let finalAssistantAnswer: ResolvedAssistantAnswer = { content: "", citations: [] };
    let completionWasAborted = false;
    let successfulCompletionServers = routedServersWithAuth;

    try {
      // Primary tool-enabled completion path.
      const initialCompletion = await runCompletion(
        buildMessagesForRun(successfulCompletionServers),
        successfulCompletionServers,
      );
      completionResult = initialCompletion.completionResult;
      finalAssistantAnswer = initialCompletion.resolvedAnswer;
      completionWasAborted = initialCompletion.wasAborted;
    } catch (toolEnabledError) {
      // Step 6: If tools fail, patch UI/insights and retry with no MCP tools.
      applyToolFailureFallback({
        toolEnabledError,
        routedServersWithAuth,
        abortController,
        dispatch,
        sessionId,
        orchestratorInsights,
        progressUpdates,
        getState,
        latestAssistantMessageId: latestAssistantMessage.id,
      });

      successfulCompletionServers = [];
      const fallbackCompletion = await runCompletion(
        buildMessagesForRun(successfulCompletionServers),
        successfulCompletionServers,
      );
      completionResult = fallbackCompletion.completionResult;
      finalAssistantAnswer = fallbackCompletion.resolvedAnswer;
      completionWasAborted = fallbackCompletion.wasAborted;
    }

    // Step 7: Optionally enrich sparse citations and re-ground answer text.
    const currentCitations = finalAssistantAnswer.citations || completionResult?.citations || [];
    const shouldApplyEpsCitationEnrichment = shouldEnrichEpsCitations(content, currentCitations);
    const shouldApplyPmcoeCitationEnrichment =
      !shouldApplyEpsCitationEnrichment && shouldEnrichPmcoeCitations(content, currentCitations);

    if (!completionWasAborted && (shouldApplyEpsCitationEnrichment || shouldApplyPmcoeCitationEnrichment)) {
      const latestMessageContent = finalAssistantAnswer.content;
      const harvestedCitations = await harvestStandaloneCitations(
        content,
        latestMessageContent,
        successfulCompletionServers,
      );

      if (shouldApplyEpsCitationEnrichment) {
        const canonicalEpsCitations = selectCanonicalEpsCitations(harvestedCitations);
        const mergedCitations = canonicalEpsCitations.length > 0
          ? canonicalEpsCitations
          : mergeCitationsPreferConcreteUrls(currentCitations, harvestedCitations);
        const strippedMergedCitations = stripSyntheticCitationsWhenConcreteExists(mergedCitations);
        const finalEpsCitations = hasRequiredEpsLegacyCitations(strippedMergedCitations)
          ? strippedMergedCitations
          : CANONICAL_EPS_CITATION_FALLBACK;

        if (finalEpsCitations.length > 0) {
          finalAssistantAnswer = await maybeRewriteAnswerWithCitations(
            latestMessageContent,
            finalEpsCitations,
          );
        }
      } else {
        const mergedPmcoeCitations = mergeCitationsPreferConcreteUrls(currentCitations, harvestedCitations);
        const finalPmcoeCitations = stripSyntheticCitationsWhenConcreteExists(mergedPmcoeCitations);

        if (finalPmcoeCitations.length > 0) {
          finalAssistantAnswer = await maybeRewriteAnswerWithCitations(
            latestMessageContent,
            finalPmcoeCitations,
          );
        }
      }
    }

    // Step 8: Reveal finalized assistant text and any structured BITS artifacts.
    await revealAssistantAnswer(finalAssistantAnswer, { immediate: completionWasAborted });

    const bitsArtifacts = (completionResult?.mcpToolOutputs || [])
      .filter((toolOutput) => {
        const toolName = toolOutput.toolName.toLowerCase();
        const serverLabel = String(toolOutput.serverLabel || "").toLowerCase();

        if (BITS_NON_RESULT_TOOL_NAMES.has(toolName)) {
          return false;
        }

        return (
          BITS_TOOL_NAMES.has(toolName)
          || serverLabel.includes("bits")
          || toolOutput.output.includes("\"br\"")
          || toolOutput.output.includes("\"results\"")
          || toolOutput.output.includes("\"BR_NMBR\"")
        );
      })
      .map((toolOutput) => parseBitsArtifactsFromToolOutput(toolOutput.output))
      .filter((artifacts): artifacts is PlaygroundBrArtifacts => Boolean(artifacts))
      .reduce<PlaygroundBrArtifacts | undefined>((accumulator, artifacts) => {
        if (!accumulator) {
          return artifacts;
        }

        return mergeBitsArtifacts(accumulator, artifacts);
      }, undefined);

    if (bitsArtifacts && !isBrGuidancePrompt(content)) {
      dispatch(
        setMessageBrArtifacts({
          messageId: latestAssistantMessage.id,
          brArtifacts: bitsArtifacts,
        })
      );
    }
  } catch (error) {
    // Abort is user-initiated stop, not a failure state.
    if (abortController.signal.aborted) {
      return;
    }

    console.error("Completion failed:", error);

    const fallbackToastMessage = i18n.t("playground:assistant.error.toast");
    const assistantErrorMessage = i18n.t("playground:assistant.error.chat");

    const errorMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : fallbackToastMessage;

    if (placeholderAssistantMessageId) {
      dispatch(updateMessageContent({ messageId: placeholderAssistantMessageId, content: assistantErrorMessage }));
    } else {
      dispatch(addMessage({ sessionId, role: "assistant", content: assistantErrorMessage }));
    }

    dispatch(addToast({ message: errorMessage, isError: true }));
  } finally {
    // Always clean up controller and reset UI loading/phase state.
    sessionAbortControllers.delete(sessionId);
    dispatch(setAssistantResponsePhase({ sessionId, phase: "idle" }));
    dispatch(setSessionLoading({ sessionId, loading: false }));
  }
};