import { addMessage, updateMessageContent, setIsLoading, Message } from "../slices/chatSlice";
import { addToast } from "../slices/toastSlice";
import { OpenAIService } from "../../services/openaiService";
import { isTokenExpired } from "../../../util/token";
import { RootState, AppDispatch } from "..";
import { selectMessagesForSession } from "../selectors/chatSelectors";
import i18n from "../../../i18n";

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

    const sessionMessages = selectMessagesForSession(getState(), sessionId);

    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: "",
      })
    );

    const assistantMessages = selectMessagesForSession(getState(), sessionId).filter(
      (message) => message.role === "assistant"
    );
    const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];

    if (!latestAssistantMessage) {
      throw new Error("Failed to create assistant message");
    }

    let accumulatedContent = "";

    await OpenAIService.createAzureResponse(mapMessagesForCompletion(sessionMessages), {
      userToken: accessToken,
      model: "gpt-4o",
      onStreamChunk: (chunk: string) => {
        accumulatedContent += chunk;
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessage.id,
            content: accumulatedContent,
          })
        );
      },
    });
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
