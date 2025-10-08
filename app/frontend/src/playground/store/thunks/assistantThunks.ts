import { addMessage, updateMessageContent, setIsLoading, Message } from "../slices/chatSlice";
import { addToast } from "../slices/toastSlice";
import { OpenAIService } from "../../services/openaiService";
import { isTokenExpired } from "../../../util/token";
import { RootState, AppDispatch } from "..";

interface CompletionMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

const mapMessagesForCompletion = (messages: Message[]): CompletionMessage[] =>
  messages.map(({ role, content }) => ({
    role,
    content,
  }));

export interface SendAssistantMessageArgs {
  sessionId: string;
  content: string;
  attachments?: unknown[];
}

export const sendAssistantMessage = ({
  sessionId,
  content,
  attachments,
}: SendAssistantMessageArgs) => async (
  dispatch: AppDispatch,
  getState: () => RootState
): Promise<void> => {
  dispatch(setIsLoading(true));

  let assistantMessageId: string | null = null;

  try {
    const { accessToken } = getState().auth;

    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: "Authentication required. Please refresh the page.",
          isError: true,
        })
      );
      return;
    }

    dispatch(
      addMessage({
        sessionId,
        role: "user",
        content,
        attachments,
      })
    );

    const stateAfterUserMessage = getState();
    const sessionMessages = stateAfterUserMessage.chat.messages.filter(
      (message) => message.sessionId === sessionId
    );

    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: "",
      })
    );

    const assistantMessage = getState()
      .chat.messages.filter(
        (message) => message.sessionId === sessionId && message.role === "assistant"
      )
      .slice(-1)[0];

    if (!assistantMessage) {
      throw new Error("Failed to create assistant message");
    }

    assistantMessageId = assistantMessage.id;
    let accumulatedContent = "";

    await OpenAIService.createAzureResponse(
      mapMessagesForCompletion(sessionMessages),
      {
        userToken: accessToken,
        model: "gpt-4o",
        onStreamChunk: (chunk: string) => {
          if (!assistantMessageId) {
            return;
          }
          accumulatedContent += chunk;
          dispatch(
            updateMessageContent({
              messageId: assistantMessageId,
              content: accumulatedContent,
            })
          );
        },
      }
    );
  } catch (error) {
    console.error("Completion failed:", error);

    const errorMessage =
      error instanceof Error
        ? error.message
        : "An error occurred during completion";

    if (assistantMessageId) {
      dispatch(
        updateMessageContent({
          messageId: assistantMessageId,
          content: "Sorry, I encountered an error while processing your request. Please try again.",
        })
      );
    } else {
      dispatch(
        addMessage({
          sessionId,
          role: "assistant",
          content:
            "Sorry, I encountered an error while processing your request. Please try again.",
        })
      );
    }

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
