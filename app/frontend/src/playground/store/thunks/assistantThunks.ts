import {
  addMessage,
  updateMessageContent,
  setIsLoading,
  setOrchestratorInsights,
  Message,
} from "../slices/chatSlice";
import { setIsSessionNew } from "../slices/sessionSlice"
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
  resolveServersFromInsights,
} from "../../services/orchestratorService";

const ATTACHMENT_TEXT_LIMIT = 12000;

const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

const attachmentTextCache = new Map<string, string>();
const attachmentImageCache = new Map<string, string>();

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
          console.error("Failed to load attachment image", error);
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
        console.error("Failed to extract attachment text", error);
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
 * Primary thunk that streams assistant completions, handling tools and attachment hydration.
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
  try {
    dispatch(setIsSessionNew({id: sessionId, isNew: false}))

    const { accessToken } = getState().auth;
    const dispatchForAttachments = dispatch as AppDispatch;
    const { mcpServers } = getState().tools;
    const existingSessionMessages = getState().chat.messages.filter(
      (message) => message.sessionId === sessionId
    );

    // Attach authorization tokens to MCP servers
    const serversWithAuth: Tool.Mcp[] = (mcpServers && mcpServers.length > 0 && accessToken)
      ? mcpServers.map((server: Tool.Mcp) => ({ ...server, authorization: accessToken }))
      : [];

    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: i18n.t("playground:auth.tokenExpired"),
          isError: true,
        })
      );
      return;
    }

    const orchestratorServers = serversWithAuth.filter(isOrchestratorServer);
    if (orchestratorServers.length === 0) {
      dispatch(
        addToast({
          message: "Orchestrator MCP is required but not configured in VITE_MCP_SERVERS.",
          isError: true,
        })
      );
      return;
    }

    const orchestratorInsights = await getOrchestratorInsights({
      messages: existingSessionMessages,
      currentContent: content,
      servers: serversWithAuth,
    });

    const orchestratorUnavailable =
      !orchestratorInsights || orchestratorInsights.source === "local-fallback";

    const selectedServers = orchestratorUnavailable
      ? serversWithAuth.filter((server) => !isOrchestratorServer(server))
      : resolveServersFromInsights(orchestratorInsights, serversWithAuth);
    const routedServers = selectedServers.filter(
      (server, index, all) =>
        all.findIndex(
          (entry) => entry.server_url === server.server_url && entry.server_label === server.server_label
        ) === index
    );

    const noDownstreamExpected =
      !orchestratorUnavailable &&
      (orchestratorInsights.fallbackUpstream === null ||
        (orchestratorInsights.category === "generic" && orchestratorInsights.recommendations.length === 0));

    const shouldHideOrchestratorMetadata =
      orchestratorUnavailable ||
      (orchestratorInsights.category === "generic" &&
        orchestratorInsights.recommendations.length === 0);

    if (routedServers.length === 0) {
      if (noDownstreamExpected || orchestratorUnavailable) {
        dispatch(
          setOrchestratorInsights({
            sessionId,
            insights: shouldHideOrchestratorMetadata ? null : orchestratorInsights,
          })
        );
      } else {
        dispatch(
          addToast({
            message: "Orchestrator did not return any downstream MCP route for this turn.",
            isError: true,
          })
        );
        return;
      }
    }

    const insightsWithSelection = routedServers.length > 0
      ? {
          ...(orchestratorInsights as NonNullable<typeof orchestratorInsights>),
          selectedServers: routedServers.map((server) => ({
            server_label: server.server_label,
            server_url: server.server_url || "(no-url)",
          })),
        }
      : shouldHideOrchestratorMetadata
        ? null
        : orchestratorInsights;

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

    let accumulatedContent = "";

    // Use the completion service with streaming callbacks for state management
    const completionMessages = await mapMessagesForCompletion(updatedSessionMessages, dispatchForAttachments, getState);
    const routedServersWithAuth: Tool.Mcp[] = routedServers.map((server) => ({
      ...server,
      authorization: (server as Tool.Mcp & { authorization?: string }).authorization || accessToken,
    }));

    await completionService.createCompletion(
      {
        messages: completionMessages,
        model: "gpt-4.1-mini", // Eventually leverage an orchestrator
        provider,
        userToken: accessToken,
        servers: routedServersWithAuth,
      },
      {
        onChunk: (chunk: string) => {
          accumulatedContent += chunk;
          // This is where the thunk manages state during streaming
          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: accumulatedContent,
            })
          );
        },
        onToolCall: (toolName?: string) => {
          const toolCallMessage = `\n${toolName ?? "A tool"} is being called...\n`;

          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: accumulatedContent + toolCallMessage,
            })
          );
        },
        onError: (error: Error) => {
          console.error("Streaming error:", error);
          // Could dispatch error state here if needed
        },
        onComplete: (fullText: string) => {
          console.log("Completion finished:", fullText.length, "characters");
          // Final state update if needed
        }
      }
    );

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
    dispatch(setIsLoading(false));
  }
};
