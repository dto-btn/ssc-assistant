/**
 * Assistant orchestration thunks.
 *
 * Wires orchestrator-guided MCP routing into the chat send path, including
 * progress streaming, fallback behavior, and selected-server capture for UI
 * visibility.
 */
import {
  addMessage,
  updateMessageContent,
  setIsLoading,
  setAssistantResponsePhase,
  setOrchestratorInsights,
  Message,
  MessageMcpAttribution,
  OrchestratorInsights,
} from "../slices/chatSlice";
import { setIsSessionNew, renameSession } from "../slices/sessionSlice";
import { persistSessionRename } from "./sessionManagementThunks";
import { addToast } from "../slices/toastSlice";
import {
  completionService,
  CompletionMessage,
  CompletionContentPart,
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
import { createStreamTypewriter } from "../../utils/streamTypewriter";

const ATTACHMENT_TEXT_LIMIT = 12000;
const TOOL_CALL_STATUS_PATTERN = /\n[^\n]* is being called\.\.\.\n/g;

/**
 * Derive a short session name from the first 5 words of the user's first message.
 * Keeps title within 30 characters.
 */
export const deriveSessionName = (content: string): string => {
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(" ").slice(0, 30);
};

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
const IS_DEV = import.meta.env.DEV;
const stripToolCallStatusMessages = (content: string): string =>
  content.replace(TOOL_CALL_STATUS_PATTERN, "\n").replace(/\n{3,}/g, "\n\n").trim();

/**
 * Remove duplicate servers while preserving first-seen ordering.
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
}

/**
 * Primary chat execution thunk for one user turn.
 *
 * Flow summary:
 * 1) Validate auth and discover orchestrator server.
 * 2) Ask orchestrator to classify and select downstream MCP servers.
 * 3) Build completion messages (including attachment hydration).
 * 4) Stream model output and keep Redux message content in sync.
 */
export const sendAssistantMessage = ({
  sessionId,
  content,
  attachments,
  provider = 'azure-openai', // Default provider
}: SendAssistantMessageArgs): AppThunk<Promise<void>> => async (
  dispatch,
  getState
) => {
  dispatch(setIsLoading(true));
  dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));
  try {
    const isNewChat = getState().sessions.sessions.find((s) => s.id === sessionId)?.isNewChat;
    if (isNewChat) {
      // Rename chat if this is the first message in a new session
      const autoName = deriveSessionName(content);

      if (autoName) {
        dispatch(renameSession({ id: sessionId, name: autoName }));
        // Removed: void dispatch(persistSessionRename(sessionId, autoName));
        // The rename will be persisted automatically in the next archive cycle.
        // The session file is not yet created remotely to accept the rename remotely
      }

      // Mark session as no longer new
      dispatch(setIsSessionNew({id: sessionId, isNew: false}))
    }
    

    const { accessToken } = getState().auth;
    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: i18n.t("playground:auth.tokenExpired"),
          isError: true,
        })
      );
      return;
    }

    const dispatchForAttachments = dispatch as AppDispatch;
    const { mcpServers } = getState().tools;
    const existingSessionMessages = getState().chat.messages.filter(
      (message) => message.sessionId === sessionId
    );

    const serversWithAuth: Tool.Mcp[] = (mcpServers || []).map((server: Tool.Mcp) => ({
      ...server,
      authorization: accessToken,
    }));

    const hasOrchestratorServer = serversWithAuth.some(isOrchestratorServer);
    if (!hasOrchestratorServer) {
      dispatch(
        addToast({
          message: "Orchestrator MCP is not configured; routing will fall back to available MCP servers.",
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

    // Add user message to state
    dispatch(
      addMessage({
        sessionId,
        role: "user",
        content,
        attachments,
      })
    );

    // Add empty assistant message to state
    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: "",
        mcpAttribution: assistantMcpAttribution,
      })
    );

    // Re-fetch messages to include the newly added assistant message
    const updatedSessionMessages = getState().chat.messages.filter(
      (message) => message.sessionId === sessionId
    );
    const assistantMessages = updatedSessionMessages.filter(
      (message) => message.role === "assistant"
    );
    const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];

    if (!latestAssistantMessage) {
      throw new Error("Failed to create assistant message");
    }

    // Use the completion service with streaming callbacks for state management
    const completionMessages = await mapMessagesForCompletion(updatedSessionMessages, dispatchForAttachments, getState);

    // Ensure every routed MCP server carries an auth token for downstream calls.
    const routedServersWithAuth: Tool.Mcp[] = routedServers.map((server) => ({
      ...server,
      authorization: (server as Tool.Mcp & { authorization?: string }).authorization || accessToken,
    }));

    let finalMessages = completionMessages;
    const finalServersWithAuth = routedServersWithAuth;

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
          const firstRecommendation = Array.isArray(routing?.recommendations) ? routing.recommendations[0] : null;
          const selectedCategory = firstRecommendation?.category || routing?.fallback?.category || "general";
          const selectedServerId = firstRecommendation?.mcp_server_id || "none";

          finalMessages = [
            {
              role: "system",
              content: `Orchestrator preflight selected category '${selectedCategory}' and server '${selectedServerId}'. Use this as routing context.`,
            },
            ...completionMessages,
          ];
        }
      } catch (preflightError) {
        console.warn("Orchestrator preflight failed, continuing without preflight", preflightError);
      }
    }

    const completionModel = resolveCompletionModel(getState());

    const runCompletion = async (
      messagesForRun: CompletionMessage[],
      serversForRun: Tool.Mcp[],
    ): Promise<void> => {
      // One execution path used for both primary run and no-tools retry.
      let receivedFirstChunk = false;
      let pendingToolCallStatusText = "";

      const typewriter = createStreamTypewriter({
        tickMs: 20,
        charsPerTick: 4,
        burstMultiplier: 2,
        maxBufferedChars: 900,
        onUpdate: (nextText) => {
          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: nextText,
            })
          );
        },
      });

      try {
        await completionService.createCompletion(
          {
            messages: messagesForRun,
            model: completionModel,
            provider,
            userToken: accessToken,
            servers: serversForRun,
          },
          {
            onChunk: (chunk: string) => {
              if (!receivedFirstChunk && pendingToolCallStatusText) {
                // Clear transient tool-call status before typed response starts.
                pendingToolCallStatusText = "";
                dispatch(
                  updateMessageContent({
                    messageId: latestAssistantMessage.id,
                    content: "",
                  })
                );
              }

              typewriter.enqueue(chunk);
              if (!receivedFirstChunk) {
                receivedFirstChunk = true;
                dispatch(setAssistantResponsePhase({ sessionId, phase: "streaming" }));
              }
            },
            onToolCall: (toolName?: string) => {
              const toolCallMessage = `\n${toolName ?? "A tool"} is being called...\n`;
              if (!receivedFirstChunk) {
                pendingToolCallStatusText += toolCallMessage;
                dispatch(
                  updateMessageContent({
                    messageId: latestAssistantMessage.id,
                    content: pendingToolCallStatusText,
                  })
                );
              }
            },
            onError: (error: Error) => {
              if (IS_DEV) {
                console.error("Streaming error:", error);
              }
            },
            onComplete: () => undefined,
          }
        );
      } finally {
        // Let the buffer drain with pacing to avoid end-of-stream "content dump".
        await typewriter.complete({ maxWaitMs: 5000 });

        const cleanedContent = stripToolCallStatusMessages(
          typewriter.getDisplayedText(),
        );
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessage.id,
            content: cleanedContent,
          })
        );

        typewriter.stop();
      }

    };

    try {
      await runCompletion(finalMessages, finalServersWithAuth);
    } catch (toolEnabledError) {
      if (finalServersWithAuth.length === 0) {
        throw toolEnabledError;
      }

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
        })
      );

      dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));

      await runCompletion(finalMessages, []);
    }

  } catch (error) {
    console.error("Completion failed:", error);

    const fallbackToastMessage = i18n.t("playground:assistant.error.toast");
    const assistantErrorMessage = i18n.t("playground:assistant.error.chat");

    const errorMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : fallbackToastMessage;

    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: assistantErrorMessage,
      })
    );

    dispatch(
      addToast({
        message: errorMessage,
        isError: true,
      })
    );
  } finally {
    dispatch(setAssistantResponsePhase({ sessionId, phase: "idle" }));
    dispatch(setIsLoading(false));
  }
};
