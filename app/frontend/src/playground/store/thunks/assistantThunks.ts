/**
 * Assistant orchestration thunks.
 *
 * Wires orchestrator-guided MCP routing into the chat send path, including
 * progress streaming, fallback behavior, and selected-server capture for UI
 * visibility.
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
  Message,
  MessageMcpAttribution,
  OrchestratorInsights,
  PlaygroundBrArtifacts,
} from "../slices/chatSlice";
import { setIsSessionNew, renameSession } from "../slices/sessionSlice";
import { addToast, ToastSeverity } from "../slices/toastSlice";
import {
  completionService,
  CompletionMessage,
  CompletionContentPart,
  CompletionResult,
} from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";
import { AppThunk, AppDispatch } from "..";
import type { RootState } from "..";
import i18n from "../../../i18n";

import { FileAttachment } from "../../types";
import { extractFileText, fetchFileDataUrl } from "../../api/storage";
import { Tool } from "openai/resources/responses/responses.mjs";
import {
  getOrchestratorInsights,
  OrchestratorProgressEvent,
  resolveServersFromInsights,
} from "../../services/orchestratorService";
import { Citation } from "../../utils/citations";
import { createStreamTypewriter } from "../../utils/streamTypewriter";
import { selectMessagesForSession } from "../selectors/chatSelectors";
import {
  TOOL_CALL_STATUS_PATTERN,
} from "../../constants/patterns";
import {
  isLikelyEpsCitationQuery,
  isLikelyPmcoeCitationQuery,
  hasRequiredEpsLegacyCitations,
  shouldEnrichEpsCitations,
  shouldEnrichPmcoeCitations,
  stripSyntheticCitationsWhenConcreteExists,
  mergeCitationsPreferConcreteUrls,
  selectCanonicalEpsCitations,
  CANONICAL_EPS_CITATION_FALLBACK,
} from "../../services/citationEnrichmentService";
import {
  BITS_TOOL_NAMES,
  BITS_NON_RESULT_TOOL_NAMES,
  parseBitsArtifactsFromToolOutput,
  mergeBitsArtifacts,
  mergeBrDataByBrNumber,
  hasBitsServer,
  isBrGuidancePrompt,
} from "../../services/bitsTransformService";
import {
  buildPlaygroundChartSystemMessage,
  buildPreflightRoutingContextMessage,
  buildCompletionMessagesForRun,
  trimCompletionMessagesToLimit,
  MCP_CITATION_HARVEST_SYSTEM_PROMPT,
  MCP_GROUNDED_REWRITE_SYSTEM_PROMPT,
  deriveSessionName,
} from "../../services/messageBuildService";

// Re-export helpers consumed by tests and components via this module's path.
export {
  isLikelyEpsCitationQuery,
  isLikelyPmcoeCitationQuery,
  hasRequiredEpsLegacyCitations,
  shouldEnrichEpsCitations,
  shouldEnrichPmcoeCitations,
  deriveSessionName,
};

/**
 * Per-session AbortControllers for in-flight streaming requests.
 * Stored outside Redux because AbortController instances are not serializable.
 * The map is keyed by sessionId and cleaned up in the thunk's finally block.
 */
const sessionAbortControllers = new Map<string, AbortController>();

/**
 * Cancels the active streaming request for the given session.
 * Safe to call even if no request is in-flight (no-op).
 */
export function stopAssistantMessage(sessionId: string): void {
  sessionAbortControllers.get(sessionId)?.abort();
}

const ATTACHMENT_TEXT_LIMIT = 12000;



/**
 * Identify orchestrator MCP entries so they are excluded from downstream tool runs.
 */
const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

const attachmentTextCache = new Map<string, string>();
const attachmentImageCache = new Map<string, string>();
const MAX_ORCHESTRATOR_PROGRESS_UPDATES = 20;
const MAX_GROUNDED_REWRITE_EXCERPT_CHARS = 700;
const FINAL_REVEAL_TICK_MS = 25;
const FINAL_REVEAL_CHARS_PER_TICK = 10;
const FINAL_REVEAL_BURST_MULTIPLIER = 3;
const FINAL_REVEAL_MAX_BUFFERED_CHARS = 360;
const FINAL_REVEAL_MAX_WAIT_MS = 4500;
const IS_DEV = import.meta.env.DEV;
const IS_CITATION_DEBUG_ENABLED = String(import.meta.env.VITE_PLAYGROUND_DEBUG_CITATIONS || "").toLowerCase() === "true";

/**
 * Remove transient tool-call status placeholders once real assistant text is available.
 */
const stripToolCallStatusMessages = (content: string): string =>
  content.replace(TOOL_CALL_STATUS_PATTERN, "\n").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Walk arbitrary tool payload shapes to find the first BITS artifact envelope.
 */
const dedupeMcpServers = (servers: Tool.Mcp[]): Tool.Mcp[] => {
  const seen = new Set<string>();
  const deduped: Tool.Mcp[] = [];
  for (const server of servers) {
    const key = `${server.server_url || ""}|${server.server_label || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(server);
  }
  return deduped;
};

/**
 * Prepend one generic grounding instruction whenever the playground is about
 * to run with routed MCP servers.
 */
const hasToastWithSeverity = (
  state: RootState,
  message: string,
  severity: ToastSeverity,
): boolean => {
  return state.toast.toasts.some((toast) => {
    const toastSeverity: ToastSeverity = toast.severity || (toast.isError ? "error" : "success");
    return toast.message === message && toastSeverity === severity;
  });
};

/**
 * Build message-scoped MCP attribution from routed servers for UI rendering.
 */
const buildMessageMcpAttribution = (
  routedServers: Tool.Mcp[],
  insights: Pick<OrchestratorInsights, "category" | "status" | "statusMessage"> | null,
): MessageMcpAttribution | undefined => {
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

const shouldRequireToolsForRun = (routedServers: Tool.Mcp[]): boolean => {
  return hasBitsServer(routedServers);
};

/**
 * Prevent noisy UI updates when identical progress events are emitted repeatedly.
 */
const isDuplicateProgressUpdate = (
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

/**
 * Build a lightweight interim insights object used while routing is in progress.
 */
const buildOrchestratorProgressInsights = (
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

/**
 * Feature flag for orchestrator preflight classification/routing.
 */
const shouldUseOrchestratorPreflight = (): boolean => {
  return import.meta.env.VITE_PLAYGROUND_ORCHESTRATOR_PREFLIGHT !== "false";
};

/**
 * Resolve model id for LiteLLM-backed Playground calls.
 */
const resolveCompletionModel = (state: RootState): string => {
  const selectedModel = String(state.models?.selectedModel || "").trim();

  // Explicit env override has highest priority for LiteLLM-backed Playground calls.
  const configuredLiteLLMModel = String(import.meta.env.VITE_LITELLM_MODEL || "").trim();
  if (configuredLiteLLMModel) {
    return configuredLiteLLMModel;
  }

  // Preserve manually selected model when present.
  if (selectedModel) {
    // Map legacy/default selections to the currently configured LiteLLM model id.
    if (["gpt-3.5", "gpt-4", "gpt-4-turbo"].includes(selectedModel)) {
      return "gpt-4o";
    }
    return selectedModel;
  }

  // Fallback must be non-empty for /v1/responses.
  return "gpt-4o";
};

/**
 * Locate orchestrator MCP server definition from configured tool servers.
 */
const findOrchestratorServer = (servers: Tool.Mcp[]): Tool.Mcp | undefined => {
  return servers.find((server) => {
    const label = String(server.server_label || "").toLowerCase();
    const description = String(server.server_description || "").toLowerCase();
    return label.includes("orchestrator") || description.includes("orchestrator");
  });
};

/**
 * Translate orchestrator MCP endpoint into the preflight REST route.
 */
const toOrchestratorPreflightUrl = (serverUrl: string): string => {
  const trimmed = serverUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/mcp")) {
    return `${trimmed.slice(0, -4)}/orchestrator/suggest-route`;
  }
  return `${trimmed}/orchestrator/suggest-route`;
};

/**
 * Extract text content from the most recent user message for preflight routing.
 */
const extractLastUserText = (messages: CompletionMessage[]): string => {
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

/**
 * Clamp long attachment transcripts so prompts stay within token limits.
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n\n[Attachment truncated after ${maxLength} characters of ${text.length}.]`;
};

/**
 * Convert attachment metadata into multimodal content parts by pulling text or
 * image data from the storage API and caching the results between requests.
 */
async function resolveAttachmentParts(
  attachments: FileAttachment[] = [],
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<CompletionContentPart[]> {
  const parts: CompletionContentPart[] = [];
  const extractionFailures: string[] = [];
  const emptyExtractions: string[] = [];
  const state = getState();
  const accessToken = state.auth?.accessToken ?? null;

  for (const attachment of attachments) {
    const cacheKey = attachment.blobName || attachment.url;
    const contentType = attachment.contentType ?? undefined;
    const attachmentName = attachment.originalName || attachment.blobName || "attachment";

    if (contentType?.startsWith("image/")) {
      let dataUrl = cacheKey ? attachmentImageCache.get(cacheKey) : undefined;

      if (!dataUrl && (attachment.url || attachment.blobName)) {
        try {
          const result = await fetchFileDataUrl({
            fileUrl: attachment.url,
            blobName: attachment.blobName,
            fileType: contentType,
            accessToken,
          });
          dataUrl = result.dataUrl;
          if (dataUrl && cacheKey) {
            attachmentImageCache.set(cacheKey, dataUrl);
          }
        } catch (error) {
          if (IS_DEV) {
            console.error("Failed to load attachment image", error);
          }
        }
      }

      if (!dataUrl) {
        continue;
      }

      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" is an image. Please describe what you see in the image and use that context when answering the user's request.`,
      });
      parts.push({
        type: "image_url",
        image_url: {
          url: dataUrl,
          detail: "auto",
        },
      });
      continue;
    }

    let resolvedText = cacheKey ? attachmentTextCache.get(cacheKey) : undefined;

    if (!resolvedText && attachment.url) {
      try {
        resolvedText = await extractFileText({
          fileUrl: attachment.url,
          fileType: contentType,
        });
        if (resolvedText && cacheKey) {
          attachmentTextCache.set(cacheKey, resolvedText);
        }
      } catch (error) {
        if (IS_DEV) {
          console.error("Failed to extract attachment text", error);
        }
        extractionFailures.push(attachmentName);
      }
    }

    if (!resolvedText) {
      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" could not be read. Let the user know the file might need to be converted to a different format (for example, CSV or XLSX).`,
      });
      emptyExtractions.push(attachmentName);
      continue;
    }

    const trimmed = resolvedText.trim();
    if (!trimmed) {
      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" did not contain readable text. Ask the user for a different format if the data seems important.`,
      });
      emptyExtractions.push(attachmentName);
      continue;
    }

    const limited = truncateText(trimmed, ATTACHMENT_TEXT_LIMIT);

    parts.push({
      type: "text",
      text: `Attachment "${attachmentName}" contents:\n\n${limited}`,
    });
  }

  if (extractionFailures.length || emptyExtractions.length) {
    const problems = [...new Set([...extractionFailures, ...emptyExtractions])];
    const message = i18n.t("playground:errors.attachmentExtractionFailed", {
      defaultValue: "Could not read these files: {{files}}.",
      files: problems.join(", "),
    });
    dispatch(
      addToast({
        message,
        isError: true,
      })
    );
  }

  return parts;
}

/**
 * Combine the base message text with any generated attachment parts before sending to the provider.
 */
const buildMessageContent = async (
  message: Message,
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<string | CompletionContentPart[]> => {
  const baseText = message.content?.trim() ?? "";
  const attachmentParts = message.attachments?.length
    ? await resolveAttachmentParts(message.attachments, dispatch, getState)
    : [];

  if (!attachmentParts.length) {
    return baseText;
  }

  const contentParts: CompletionContentPart[] = [];

  if (baseText) {
    contentParts.push({ type: "text", text: baseText });
  }

  contentParts.push(...attachmentParts);

  return contentParts;
};

/**
 * Prepare the full conversation history for a completion call, resolving
 * attachments in parallel to avoid serial network trips.
 */
const mapMessagesForCompletion = async (
  messages: Message[],
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<CompletionMessage[]> => {
  return Promise.all(
    messages.map(async (message) => {
      const content = await buildMessageContent(message, dispatch, getState);
      if (message.role === "system") {
        const systemContent = typeof content === "string"
          ? content
          : content
              .map((part) => (part.type === "text" ? part.text : "[non-text attachment omitted]"))
              .join("\n");

        const systemMessage: CompletionMessage = {
          role: "system",
          content: systemContent,
        };

        return systemMessage;
      }

      if (message.role === "assistant") {
        const assistantContent = typeof content === "string"
          ? content
          : content
              .map((part) => (part.type === "text" ? part.text : "[non-text attachment omitted]"))
              .join("\n");

        const assistantMessage: CompletionMessage = {
          role: "assistant",
          content: assistantContent,
        };

        return assistantMessage;
      }

      const userMessage: CompletionMessage = {
        role: "user",
        content,
      };

      return userMessage;
    })
  );
};

export interface SendAssistantMessageArgs {
  sessionId: string;
  content: string;
  attachments?: FileAttachment[];
  provider?: 'azure-openai' | 'aws-bedrock'; // Future provider selection
  /**
   * When `true`, skip adding the user message to the store before sending.
   * Use this when the user message is already present (e.g. regenerate), so
   * the existing turn stays visible and no duplicate is created.
   */
  skipUserMessage?: boolean;
  /**
   * Optional message ID to delete before adding the next assistant turn.
   * Used by regenerate to ensure the old message is only removed if auth
   * checks pass and the new request proceeds.
   */
  deleteMessageId?: string;
}

type ResolvedAssistantAnswer = {
  content: string;
  citations: CompletionResult["citations"];
};

type BufferedCompletionRun = {
  completionResult?: CompletionResult;
  resolvedAnswer: ResolvedAssistantAnswer;
  wasAborted: boolean;
};

/**
 * Primary chat execution thunk for one user turn.
 *
 * Flow summary:
 * 1) Validate auth and discover orchestrator server.
 * 2) Ask orchestrator to classify and select downstream MCP servers.
 * 3) Build completion messages (including attachment hydration).
 * 4) Buffer streamed draft output, stabilize citations, then reveal one final answer.
 */
export const sendAssistantMessage = ({
  sessionId,
  content,
  attachments,
  provider = 'azure-openai', // Default provider
  skipUserMessage = false,
  deleteMessageId,
}: SendAssistantMessageArgs): AppThunk<Promise<void>> => async (
  dispatch,
  getState
) => {
  dispatch(setSessionLoading({ sessionId, loading: true }));
  dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));
  const abortController = new AbortController();
  sessionAbortControllers.set(sessionId, abortController);
  // Tracks the placeholder message ID outside the try so the catch block can
  // update it with the error text rather than adding a second empty assistant turn.
  let placeholderAssistantMessageId: string | undefined;
  try {
    const { accessToken } = getState().auth;
    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: i18n.t("playground:auth.tokenExpired"),
          isError: true,
        })
      );
      dispatch(setSessionLoading({ sessionId, loading: false }));
      return;
    }

    const isNewChat = getState().sessions.sessions.find((s) => s.id === sessionId)?.isNewChat;
    if (isNewChat) {
      const meaningfulText = content.trim().length > 0;
      const meaningfulTurn = meaningfulText || (attachments && attachments.length > 0);

      if (meaningfulText) {
        // Rename chat if this is the first message with text in a new session
        const autoName = deriveSessionName(content);
        if (autoName) {
          dispatch(renameSession({ id: sessionId, name: autoName }));
        }
      }

      if (meaningfulTurn) {
        // Mark session as no longer new if there's text or attachments
        dispatch(setIsSessionNew({ id: sessionId, isNew: false }));
      }
    }

    const dispatchForAttachments = dispatch as AppDispatch;
    const { mcpServers } = getState().tools;
    const existingSessionMessages = selectMessagesForSession(getState(), sessionId);

    // If a deleteMessageId is provided (e.g. for regenerate), remove the old
    // message now that auth checks have passed and we are ready to proceed.
    if (deleteMessageId) {
      dispatch(deleteMessage(deleteMessageId));
    }

    // Add the user message and an empty assistant placeholder synchronously,
    // BEFORE any await. This ensures activeAssistantMessageId in ChatMessages
    // immediately points to the new placeholder, so the "thinking" label
    // appears on the correct (new) message row rather than the previous one.
    if (!skipUserMessage) {
      dispatch(
        addMessage({
          sessionId,
          role: "user",
          content,
          attachments,
        })
      );
    }

    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: "",
      })
    );

    // Capture the id of the placeholder assistant message we just added so
    // we can target it for content updates and attribution once routing resolves.
    const placeholderAssistantMessages = selectMessagesForSession(getState(), sessionId).filter(
      (message) => message.role === "assistant"
    );
    const latestAssistantMessage =
      placeholderAssistantMessages[placeholderAssistantMessages.length - 1];

    if (!latestAssistantMessage) {
      throw new Error("Failed to create assistant message");
    }
    placeholderAssistantMessageId = latestAssistantMessage.id;

    const serversWithAuth: Tool.Mcp[] = (mcpServers || []).map((server: Tool.Mcp) => ({
      ...server,
      authorization: accessToken,
    }));

    const hasOrchestratorServer = serversWithAuth.some(isOrchestratorServer);
    if (!hasOrchestratorServer) {
      dispatch(
        addToast({
          message: i18n.t("playground:errors.orchestratorUnconfigured"),
          isError: false,
        })
      );
    }

    const progressUpdates: OrchestratorProgressEvent[] = [];

    const orchestratorInsights = hasOrchestratorServer
      ? await getOrchestratorInsights({
          messages: existingSessionMessages,
          currentContent: content,
          servers: serversWithAuth,
          accessToken,
          onProgress: (event: OrchestratorProgressEvent) => {
            // Keep only meaningful transitions so progress UI stays readable.
            if (isDuplicateProgressUpdate(progressUpdates[progressUpdates.length - 1], event)) {
              return;
            }
            progressUpdates.push(event);
            if (progressUpdates.length > MAX_ORCHESTRATOR_PROGRESS_UPDATES) {
              progressUpdates.shift();
            }
            dispatch(
              setOrchestratorInsights({
                sessionId,
                insights: buildOrchestratorProgressInsights(event, progressUpdates.slice()),
              })
            );
          },
        })
      : null;

    // If orchestrator is unavailable, preserve existing behavior by using configured downstream servers.
    const orchestratorUnavailable = !orchestratorInsights;

    const downstreamServers = serversWithAuth.filter((server) => !isOrchestratorServer(server));

    const orchestratorRecommendedServers = orchestratorUnavailable
      ? []
      : resolveServersFromInsights(orchestratorInsights, serversWithAuth);

    const routedServers = orchestratorUnavailable
      ? dedupeMcpServers(downstreamServers)
      : orchestratorRecommendedServers.length > 0
        // Orchestrator recommendations are authoritative when present.
        ? dedupeMcpServers(orchestratorRecommendedServers)
        // If no downstream route is recommended, continue chat without MCP tools.
        : [];

    // Persist the final orchestrator decision snapshot so both end-user and
    // developer panels can explain why a tool route was or was not selected.

    const finalProgress = progressUpdates[progressUpdates.length - 1];

    const baseInsights = orchestratorInsights
      ? {
          ...orchestratorInsights,
          status: finalProgress?.status || "done",
          statusMessage:
            finalProgress?.message ||
            (orchestratorInsights.fallbackReason
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

    const assistantMcpAttribution = buildMessageMcpAttribution(
      routedServers,
      insightsWithSelection,
    );

    dispatch(setOrchestratorInsights({ sessionId, insights: insightsWithSelection }));

    // Now that routing is resolved, apply the MCP attribution to the placeholder
    // assistant message that was already added before the orchestrator await.
    if (assistantMcpAttribution) {
      dispatch(
        setMessageAttribution({
          messageId: latestAssistantMessage.id,
          attribution: assistantMcpAttribution,
        })
      );
    }

    // Re-fetch messages (user + placeholder assistant are already in state).
    // Exclude the empty placeholder so the LLM does not receive a trailing
    // empty assistant turn in its context window.
    const updatedSessionMessages = selectMessagesForSession(getState(), sessionId).filter(
      (message) => message.id !== latestAssistantMessage.id
    );
    
    // Use the completion service with streaming callbacks for state management
    const completionMessages = await mapMessagesForCompletion(updatedSessionMessages, dispatchForAttachments, getState);

    // Ensure every routed MCP server carries an auth token for downstream calls.
    const routedServersWithAuth: Tool.Mcp[] = routedServers.map((server) => ({
      ...server,
      authorization: (server as Tool.Mcp & { authorization?: string }).authorization || accessToken,
    }));

    const chartSystemMessage = buildPlaygroundChartSystemMessage();
    const finalServersWithAuth = routedServersWithAuth;
    const baseCompletionMessages = [
      chartSystemMessage,
      ...completionMessages,
    ];
    let preflightRoutingContextMessage: CompletionMessage | undefined;

    const orchestratorServer = findOrchestratorServer(serversWithAuth);
    const orchestratorServerUrl = orchestratorServer?.server_url;
    if (shouldUseOrchestratorPreflight() && orchestratorServerUrl) {
      try {
        const preflightResponse = await fetch(toOrchestratorPreflightUrl(orchestratorServerUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: extractLastUserText(completionMessages) }],
            max_recommendations: 3,
            require_single_best: false,
            metadata: { source: "playground-preflight" },
          }),
        });

        if (preflightResponse.ok) {
          const routing = await preflightResponse.json();

          preflightRoutingContextMessage = buildPreflightRoutingContextMessage(routing);
        }
      } catch (preflightError) {
        console.warn("Orchestrator preflight failed, continuing without preflight", preflightError);
      }
    }

    const buildMessagesForRun = (serversForRun: Tool.Mcp[]): { 
      messages: CompletionMessage[]; 
      wasTruncated: boolean;
    } => {
      const messagesForRun = buildCompletionMessagesForRun({
        baseMessages: baseCompletionMessages,
        routedServers: serversForRun,
        preflightRoutingContextMessage,
        userPrompt: content,
      });

      return trimCompletionMessagesToLimit(messagesForRun);
    };

    const completionModel = resolveCompletionModel(getState());

    const maybeRewriteAnswerWithCitations = async (
      draftText: string,
      citations: CompletionResult["citations"],
    ): Promise<{
      content: string;
      citations: CompletionResult["citations"];
    }> => {
      if (!draftText.trim() || !citations?.length) {
        return {
          content: draftText,
          citations,
        };
      }

      const seenEvidence = new Set<string>();
      const evidenceBlocks = citations
        .filter((citation) => typeof citation.content === "string" && citation.content.trim().length > 0)
        .filter((citation) => {
          const evidenceKey = `${citation.url}|${citation.content}`;
          if (seenEvidence.has(evidenceKey)) {
            return false;
          }

          seenEvidence.add(evidenceKey);
          return true;
        })
        .map((citation, index) => {
          const title = String(citation.title || citation.url || `Source ${index + 1}`).trim();
          const excerpt = truncateText(citation.content!.trim(), MAX_GROUNDED_REWRITE_EXCERPT_CHARS);
          const location = String(citation.url || "").trim();

          return [
            `Source ${index + 1}: ${title}`,
            location ? `Location: ${location}` : undefined,
            `Excerpt:\n${excerpt}`,
          ]
            .filter((value): value is string => Boolean(value && value.trim().length > 0))
            .join("\n");
        });

      if (evidenceBlocks.length === 0) {
        return {
          content: draftText,
          citations,
        };
      }

      try {
        const rewriteResult = await completionService.createCompletion(
          {
            messages: [
              {
                role: "system",
                content: MCP_GROUNDED_REWRITE_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  "Revise the assistant draft using only the source excerpts below.",
                  `Original user request:\n${content.trim()}`,
                  `Assistant draft:\n${draftText.trim()}`,
                  `Source excerpts:\n${evidenceBlocks.join("\n\n")}`,
                  "Return only the revised answer in the same language as the draft answer.",
                ].join("\n\n"),
              },
            ],
            model: completionModel,
            provider,
            userToken: accessToken,
            signal: abortController.signal,
            servers: [],
          },
          {
            onChunk: () => undefined,
            onToolCall: () => undefined,
            onError: (error: Error) => {
              if (!abortController.signal.aborted && IS_DEV) {
                console.warn("Citation-grounded rewrite failed:", error);
              }
            },
            onComplete: () => undefined,
          }
        );

        const rewrittenText = rewriteResult.fullText.trim();
        if (!rewrittenText) {
          return {
            content: draftText,
            citations,
          };
        }

        return {
          content: rewrittenText,
          // Rewritten text invalidates any annotation offsets from the first pass.
          citations: citations.map((citation) => ({
            title: citation.title,
            url: citation.url,
            content: citation.content,
          })),
        };
      } catch (rewriteError) {
        if (!abortController.signal.aborted && IS_DEV) {
          console.warn("Citation-grounded rewrite failed:", rewriteError);
        }

        return {
          content: draftText,
          citations,
        };
      }
    };

    const revealAssistantAnswer = async (
      answer: ResolvedAssistantAnswer,
      options?: { immediate?: boolean },
    ): Promise<void> => {
      if (options?.immediate || !answer.content.trim()) {
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessage.id,
            content: answer.content,
            citations: answer.citations,
          })
        );
        return;
      }

      const buildStoppedContent = (content: string): string => {
        const stopMarker = `\n\n*${i18n.t("playground:assistant.stopped")}*`;
        const trimmedContent = content.trimEnd();

        if (!trimmedContent) {
          return stopMarker.trimStart();
        }

        let completedContent = trimmedContent;
        const unmatchedBacktickFenceCount = (trimmedContent.match(/^```/gm) || []).length;
        const unmatchedTildeFenceCount = (trimmedContent.match(/^~~~/gm) || []).length;

        if (unmatchedBacktickFenceCount % 2 !== 0) {
          completedContent += "\n```";
        }

        if (unmatchedTildeFenceCount % 2 !== 0) {
          completedContent += "\n~~~";
        }

        return completedContent + stopMarker;
      };

      if (abortController.signal.aborted) {
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessage.id,
            content: buildStoppedContent(""),
            citations: answer.citations,
          })
        );
        return;
      }

      dispatch(setAssistantResponsePhase({ sessionId, phase: "streaming" }));

      const revealTypewriter = createStreamTypewriter({
        tickMs: FINAL_REVEAL_TICK_MS,
        charsPerTick: FINAL_REVEAL_CHARS_PER_TICK,
        burstMultiplier: FINAL_REVEAL_BURST_MULTIPLIER,
        maxBufferedChars: FINAL_REVEAL_MAX_BUFFERED_CHARS,
        onUpdate: (nextText) => {
          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: nextText,
              citations: answer.citations,
            })
          );
        },
      });
      let wasAbortedDuringReveal = false;
      const handleAbortDuringReveal = (): void => {
        wasAbortedDuringReveal = true;
        revealTypewriter.stop();
      };

      abortController.signal.addEventListener("abort", handleAbortDuringReveal, { once: true });

      try {
        revealTypewriter.enqueue(answer.content);
        await revealTypewriter.complete({ maxWaitMs: FINAL_REVEAL_MAX_WAIT_MS });
        const revealedContent = revealTypewriter.getDisplayedText();
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessage.id,
            content: wasAbortedDuringReveal
              ? buildStoppedContent(revealedContent)
              : answer.content,
            citations: answer.citations,
          })
        );
      } finally {
        abortController.signal.removeEventListener("abort", handleAbortDuringReveal);
        revealTypewriter.stop();
      }
    };

    const harvestStandaloneCitations = async (
      promptText: string,
      draftText: string,
      serversForRun: Tool.Mcp[],
    ): Promise<Citation[]> => {
      if (!promptText.trim() || serversForRun.length === 0) {
        return [];
      }

      try {
        const harvestResult = await completionService.createCompletion(
          {
            messages: [
              {
                role: "system",
                content: MCP_CITATION_HARVEST_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  "Retrieve authoritative source excerpts and citations for the request below.",
                  `User request:\n${promptText.trim()}`,
                  draftText.trim() ? `Current assistant draft:\n${draftText.trim()}` : undefined,
                  "Use the available MCP tools. Review all relevant sources returned by the MCP server before responding.",
                  "Return evidence from all relevant source documents, aiming for multiple distinct sources when available.",
                  "Prefer official sources and source excerpts, and do not stop after the first matching source.",
                ]
                  .filter((value): value is string => Boolean(value && value.trim().length > 0))
                  .join("\n\n"),
              },
            ],
            model: completionModel,
            provider,
            userToken: accessToken,
            signal: abortController.signal,
            servers: serversForRun,
            toolChoice: "required",
          },
          {
            onChunk: () => undefined,
            onToolCall: () => undefined,
            onError: (error: Error) => {
              if (!abortController.signal.aborted && IS_DEV) {
                console.warn("Standalone citation harvest failed:", error);
              }
            },
            onComplete: () => undefined,
          }
        );

        return harvestResult.citations || [];
      } catch (harvestError) {
        if (!abortController.signal.aborted && IS_DEV) {
          console.warn("Standalone citation harvest failed:", harvestError);
        }

        return [];
      }
    };

    /**
     * Fetch full BR details for each listed BR number by calling
     * `get_request_status` (or equivalent) on the BITS MCP server.
     *
     * The initial `search_requests` response may include only a subset of
     * fields based on what was queried. This pass fetches every available
     * field for each BR and returns enriched rows that can be merged back
     * into the base artifact set.
     */
    const enrichBrDataWithFullDetails = async (
      brNumbers: string[],
      bitsServers: Tool.Mcp[],
    ): Promise<Record<string, unknown>[]> => {
      if (brNumbers.length === 0 || bitsServers.length === 0) return [];

      try {
        const enrichResult = await completionService.createCompletion(
          {
            messages: [
              {
                role: "system",
                content:
                  "You are a data retrieval assistant. For each BR number provided by the user, call get_request_status to retrieve the complete details. Do not summarize or add commentary — only invoke the tool for each number.",
              },
              {
                role: "user",
                content: `Retrieve full details for the following business requests: ${brNumbers.join(", ")}. Call get_request_status for each BR number.`,
              },
            ],
            model: completionModel,
            provider,
            userToken: accessToken,
            signal: abortController.signal,
            servers: bitsServers,
            toolChoice: "required",
          },
          {
            onChunk: () => undefined,
            onToolCall: () => undefined,
            onError: (error: Error) => {
              if (!abortController.signal.aborted && IS_DEV) {
                console.warn("BR enrichment pass error:", error);
              }
            },
            onComplete: () => undefined,
          }
        );

        // Collect every BR row returned across all tool outputs.
        return (enrichResult.mcpToolOutputs || [])
          .filter((toolOutput) => {
            const toolName = toolOutput.toolName.toLowerCase();
            return (
              !BITS_NON_RESULT_TOOL_NAMES.has(toolName)
              && (BITS_TOOL_NAMES.has(toolName)
                || toolOutput.output.includes('"BR_NMBR"'))
            );
          })
          .flatMap((toolOutput) => {
            const artifacts = parseBitsArtifactsFromToolOutput(toolOutput.output);
            return artifacts?.brData ?? [];
          });
      } catch (enrichError) {
        if (!abortController.signal.aborted && IS_DEV) {
          console.warn("BR enrichment pass failed:", enrichError);
        }
        return [];
      }
    };

    const runCompletion = async (
      messagesForRun: CompletionMessage[],
      serversForRun: Tool.Mcp[],
    ): Promise<BufferedCompletionRun> => {
      // One execution path used for both primary run and no-tools retry.
      let receivedFirstChunk = false;
      let bufferedDraftText = "";

      let completionResult: CompletionResult | undefined;

      try {
        completionResult = await completionService.createCompletion(
          {
            messages: messagesForRun,
            model: completionModel,
            provider,
            userToken: accessToken,
            servers: serversForRun,
            signal: abortController.signal,
            toolChoice: shouldRequireToolsForRun(serversForRun) ? "required" : undefined,
          },
          {
            onChunk: (chunk: string) => {
              bufferedDraftText += chunk;
              if (!receivedFirstChunk) {
                receivedFirstChunk = true;
                dispatch(setAssistantResponsePhase({ sessionId, phase: "drafting" }));
              }
            },
            onToolCall: () => undefined,
            onError: (error: Error) => {
              // Abort errors are expected (user clicked Stop) — don't log them.
              if (abortController.signal.aborted) return;
              if (IS_DEV) {
                console.error("Streaming error:", error);
              }
            },
            onComplete: () => undefined,
          }
        );
      } catch (error) {
        if (!abortController.signal.aborted) {
          throw error;
        }
      }

      const wasAborted = abortController.signal.aborted;
      const resolvedContent = bufferedDraftText.trim().length > 0
        ? bufferedDraftText
        : (completionResult?.fullText || bufferedDraftText);
      const cleanedContent = stripToolCallStatusMessages(resolvedContent);

      if (!receivedFirstChunk && !wasAborted && cleanedContent.trim().length > 0) {
        dispatch(setAssistantResponsePhase({ sessionId, phase: "drafting" }));
      }

      if (IS_CITATION_DEBUG_ENABLED) {
        console.debug("[playground-citations] litellm completion result", {
          provider,
          model: completionModel,
          citationCount: completionResult?.citations?.length ?? 0,
          citations: completionResult?.citations ?? [],
        });
      }

      const buildStoppedContent = (content: string): string => {
        const stopMarker = `\n\n*${i18n.t("playground:assistant.stopped")}*`;
        const trimmedContent = content.trimEnd();

        if (!trimmedContent) {
          return stopMarker.trimStart();
        }

        let completedContent = trimmedContent;
        const backtickFenceCount = (trimmedContent.match(/^```/gm) || []).length;
        const tildeFenceCount = (trimmedContent.match(/^~~~/gm) || []).length;

        if (backtickFenceCount % 2 !== 0) {
          completedContent += "\n```";
        }

        if (tildeFenceCount % 2 !== 0) {
          completedContent += "\n~~~";
        }

        return completedContent + stopMarker;
      };
      const finalContent = wasAborted
        ? buildStoppedContent(cleanedContent)
        : cleanedContent;
      const rewrittenAnswer = wasAborted
        ? {
            content: finalContent,
            citations: completionResult?.citations,
          }
        : await maybeRewriteAnswerWithCitations(
            cleanedContent,
            completionResult?.citations,
          );

      return {
        completionResult,
        resolvedAnswer: rewrittenAnswer,
        wasAborted,
      };

    };

    let completionResult: CompletionResult | undefined;
    let finalAssistantAnswer: ResolvedAssistantAnswer = {
      content: "",
      citations: [],
    };
    let completionWasAborted = false;
    let successfulCompletionServers = finalServersWithAuth;

    try {
      const initialRun = buildMessagesForRun(successfulCompletionServers);

      if (initialRun.wasTruncated) {
        const truncationWarningMessage = i18n.t("playground:assistant.contextTruncated.toast");

        if (!hasToastWithSeverity(getState(), truncationWarningMessage, "warning")) {
          dispatch(
            addToast({
              message: truncationWarningMessage,
              severity: "warning",
              isError: false,
            })
          );
        }
      }

      const initialCompletion = await runCompletion(
        initialRun.messages,
        successfulCompletionServers,
      );
      completionResult = initialCompletion.completionResult;
      finalAssistantAnswer = initialCompletion.resolvedAnswer;
      completionWasAborted = initialCompletion.wasAborted;
    } catch (toolEnabledError) {
      if (finalServersWithAuth.length === 0 || abortController.signal.aborted) {
        throw toolEnabledError;
      }

      dispatch(
        addToast({
          message: i18n.t("playground:errors.mcpUnavailable"),
          isError: false,
        })
      );

      const retryEvent: OrchestratorProgressEvent = {
        status: "routing",
        message: "Retried without tools after downstream tool failure",
        timestamp: new Date().toISOString(),
        transport: orchestratorInsights?.transport === "streamable-http" ? "streamable-http" : undefined,
      };

      if (!isDuplicateProgressUpdate(progressUpdates[progressUpdates.length - 1], retryEvent)) {
        progressUpdates.push(retryEvent);
        if (progressUpdates.length > MAX_ORCHESTRATOR_PROGRESS_UPDATES) {
          progressUpdates.shift();
        }
      }

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
        console.warn(
          "Tool-enabled completion failed; retrying without MCP tools.",
          toolEnabledError
        );
      }

      dispatch(
        updateMessageContent({
          messageId: latestAssistantMessage.id,
          content: "",
          citations: [],
        })
      );

      dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));

      successfulCompletionServers = [];
      // Carry the successful server set forward so downstream enrichment
      // does not re-enter the same failing MCP routes after the fallback.
      const fallbackRun = buildMessagesForRun(successfulCompletionServers);
      const fallbackCompletion = await runCompletion(
        fallbackRun.messages,
        successfulCompletionServers,
      );
      completionResult = fallbackCompletion.completionResult;
      finalAssistantAnswer = fallbackCompletion.resolvedAnswer;
      completionWasAborted = fallbackCompletion.wasAborted;
    }

    const currentCitations = finalAssistantAnswer.citations || completionResult?.citations || [];
    const shouldApplyEpsCitationEnrichment = shouldEnrichEpsCitations(content, currentCitations);
    const shouldApplyPmcoeCitationEnrichment =
      !shouldApplyEpsCitationEnrichment && shouldEnrichPmcoeCitations(content, currentCitations);

    if (!completionWasAborted && (shouldApplyEpsCitationEnrichment || shouldApplyPmcoeCitationEnrichment)) {
      const latestMessageContent = finalAssistantAnswer.content;
      // Harvest only from the server set used by the successful completion path
      // to avoid repeated MCP failures and extra latency.
      const harvestedCitations = await harvestStandaloneCitations(
        content,
        latestMessageContent,
        successfulCompletionServers,
      );

      if (shouldApplyEpsCitationEnrichment) {
        const canonicalEpsCitations = selectCanonicalEpsCitations(harvestedCitations);
        const mergedCitations = canonicalEpsCitations.length > 0
          ? canonicalEpsCitations
          : mergeCitationsPreferConcreteUrls(
              currentCitations,
              harvestedCitations,
            );
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
        const mergedPmcoeCitations = mergeCitationsPreferConcreteUrls(
          currentCitations,
          harvestedCitations,
        );
        const finalPmcoeCitations = stripSyntheticCitationsWhenConcreteExists(mergedPmcoeCitations);

        if (finalPmcoeCitations.length > 0) {
          finalAssistantAnswer = await maybeRewriteAnswerWithCitations(
            latestMessageContent,
            finalPmcoeCitations,
          );
        }
      }
    }

    await revealAssistantAnswer(finalAssistantAnswer, { immediate: completionWasAborted });

    const bitsArtifacts = (completionResult?.mcpToolOutputs || [])
      .filter((toolOutput) => {
        const toolName = toolOutput.toolName.toLowerCase();
        const serverLabel = String(toolOutput.serverLabel || "").toLowerCase();

        // Ignore helper/metadata tools that can return schema-like payloads.
        // Those payloads are not BR result rows and should never trigger the grid UI.
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

    // Guidance/example prompts should remain narrative. Some tool chains can
    // still emit BR result payloads opportunistically; suppress grid artifacts
    // for those intents to avoid replacing the assistant explanation.
    const allowBrArtifactsForPrompt = !isBrGuidancePrompt(content);

    if (bitsArtifacts && allowBrArtifactsForPrompt) {
      // Enrich listed BRs with full field data by fetching each BR's complete
      // details via get_request_status. The initial search_requests output may
      // only include the fields that were queried; this pass ensures all
      // available fields are populated in the artifact rows.
      let finalBitsArtifacts = bitsArtifacts;

      if (!completionWasAborted && bitsArtifacts.brData && bitsArtifacts.brData.length > 0) {
        const bitsServers = successfulCompletionServers.filter((s) => hasBitsServer([s]));
        const brNumbers = bitsArtifacts.brData
          .map((row) => row.BR_NMBR)
          .filter((num): num is string | number => num !== undefined && num !== null)
          .map((num) => String(num));

        if (brNumbers.length > 0 && bitsServers.length > 0) {
          const enrichedRows = await enrichBrDataWithFullDetails(brNumbers, bitsServers);
          if (enrichedRows.length > 0) {
            finalBitsArtifacts = {
              ...bitsArtifacts,
              brData: mergeBrDataByBrNumber(bitsArtifacts.brData, enrichedRows),
            };
          }
        }
      }

      dispatch(
        setMessageBrArtifacts({
          messageId: latestAssistantMessage.id,
          brArtifacts: finalBitsArtifacts,
        })
      );
    }
  } catch (error) {
    // If the user explicitly stopped the response, swallow the abort error
    // silently — no toast or error message should appear in the chat.
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

    // If a placeholder was already dispatched, reuse it for the error message
    // to avoid a duplicate empty assistant turn above the error text.
    if (placeholderAssistantMessageId) {
      dispatch(updateMessageContent({ messageId: placeholderAssistantMessageId, content: assistantErrorMessage }));
    } else {
      dispatch(addMessage({ sessionId, role: "assistant", content: assistantErrorMessage }));
    }

    dispatch(
      addToast({
        message: errorMessage,
        isError: true,
      })
    );
  } finally {
    sessionAbortControllers.delete(sessionId);
    dispatch(setAssistantResponsePhase({ sessionId, phase: "idle" }));
    dispatch(setSessionLoading({ sessionId, loading: false }));
  }
};
