import { addMessage, updateMessageContent, setIsLoading, Message } from "../slices/chatSlice";
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
import { selectMessagesBySessionId } from "../selectors/chatSelectors";
import i18n from "../../../i18n";
import { extractToolName } from "../../services/toolService";
import { loadTools } from "../slices/toolSlice";

import { FileAttachment } from "../../types";
import { extractFileText, fetchFileDataUrl } from "../../api/storage";

const ATTACHMENT_TEXT_LIMIT = 12000;

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
    let { availableTools } = getState().tools;

    // If tools are not loaded yet, dispatch the action to load them.
    if (availableTools.length == 0) {
      const resultAction = await dispatch(loadTools());
      if (loadTools.fulfilled.match(resultAction)) {
        availableTools = resultAction.payload; // Use the newly loaded tools
      } else {
        // Handle the case where tool loading failed
        const errorMessage = (resultAction.payload as string) || "Failed to load assistant tools.";
        throw new Error(errorMessage);
      }
    }

    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: i18n.t("playground:auth.tokenExpired"),
          isError: true,
        })
      );
      return;
    }

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
    const updatedSessionMessages = selectMessagesBySessionId(getState());
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

    await completionService.createCompletion(
      {
        messages: completionMessages,
        model: "gpt-4o", // Let MCP client decide or the user or the agentic AI decide which model to use...
        provider,
        userToken: accessToken,
        ...(availableTools && availableTools.length > 0 ? { tools: availableTools } : {}),
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
        onToolCall: (toolName: string) => {
          // Display tool call in chat
          const realToolName = extractToolName(toolName);
          const toolCallMessage = `\n${realToolName} is being called...\n`;

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
