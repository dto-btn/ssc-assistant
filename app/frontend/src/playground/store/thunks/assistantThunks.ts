import { addMessage, updateMessageContent, setIsLoading, Message } from "../slices/chatSlice";
import { addToast } from "../slices/toastSlice";
import {
  completionService,
  CompletionMessage,
  CompletionContentPart,
} from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";
import { RootState, AppDispatch } from "..";
import { selectMessagesBySessionId } from "../selectors/chatSelectors";
import i18n from "../../../i18n";
import { FileAttachment } from "../../types";
import { extractFileText, fetchFileDataUrl } from "../../api/storage";

const ATTACHMENT_TEXT_LIMIT = 12000;

const attachmentTextCache = new Map<string, string>();
const attachmentImageCache = new Map<string, string>();

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
async function resolveAttachmentParts(attachments: FileAttachment[] = []): Promise<CompletionContentPart[]> {
  const parts: CompletionContentPart[] = [];

  for (const attachment of attachments) {
    const cacheKey = attachment.blobName || attachment.url;
    const contentType = attachment.contentType ?? undefined;
    const attachmentName = attachment.originalName || attachment.blobName || "attachment";

    if (contentType?.startsWith("image/")) {
      let dataUrl = cacheKey ? attachmentImageCache.get(cacheKey) : undefined;

      if (!dataUrl && attachment.url) {
        try {
          const result = await fetchFileDataUrl({
            fileUrl: attachment.url,
            fileType: contentType,
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
      }
    }

    if (!resolvedText) {
      continue;
    }

    const trimmed = resolvedText.trim();
    if (!trimmed) {
      continue;
    }

    const limited = truncateText(trimmed, ATTACHMENT_TEXT_LIMIT);

    parts.push({
      type: "text",
      text: `Attachment "${attachmentName}" contents:\n\n${limited}`,
    });
  }

  return parts;
}

// Combine the base message text with any generated attachment parts so we can
// send a single structured payload to the provider.
const buildMessageContent = async (message: Message): Promise<string | CompletionContentPart[]> => {
  const baseText = message.content?.trim() ?? "";
  const attachmentParts = message.attachments?.length
    ? await resolveAttachmentParts(message.attachments)
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
const mapMessagesForCompletion = async (messages: Message[]): Promise<CompletionMessage[]> => {
  return Promise.all(
    messages.map(async (message) => ({
      role: message.role,
      content: await buildMessageContent(message),
    }))
  );
};

export interface SendAssistantMessageArgs {
  sessionId: string;
  content: string;
  attachments?: FileAttachment[];
  provider?: 'azure-openai' | 'aws-bedrock'; // Future provider selection
}

export const sendAssistantMessage = ({
  sessionId,
  content,
  attachments,
  provider = 'azure-openai', // Default provider
}: SendAssistantMessageArgs) => async (
  dispatch: AppDispatch,
  getState: () => RootState
): Promise<void> => {
  dispatch(setIsLoading(true));

  try {
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
    const completionMessages = await mapMessagesForCompletion(updatedSessionMessages);

    await completionService.createCompletion(
      {
        messages: completionMessages,
        model: "gpt-4o", // Let MCP client decide or the user or the agentic AI decide which model to use...
        provider,
        userToken: accessToken,
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
