import { addMessage, updateMessageContent, setIsLoading, Message } from "../slices/chatSlice";
import { addToast } from "../slices/toastSlice";
import { completionService, CompletionMessage } from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";
import { RootState, AppDispatch } from "..";
import { selectMessagesBySessionId } from "../selectors/chatSelectors";
import i18n from "../../../i18n";
import { extractToolName } from "../../services/toolService";
import { loadTools } from "../slices/toolSlice";


const mapMessagesForCompletion = (messages: Message[]): CompletionMessage[] =>
  messages.map(({ role, content }) => ({
    role,
    content,
  }));

export interface SendAssistantMessageArgs {
  sessionId: string;
  content: string;
  attachments?: unknown[];
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
    let { availableTools } = getState().tools;

    // If tools are not loaded yet, dispatch the action to load them.
    if (!availableTools) {
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
    await completionService.createCompletion(
      {
        messages: mapMessagesForCompletion(updatedSessionMessages),
        model: "gpt-4o", // Let MCP client decide or the user or the agentic AI decide which model to use...
        provider,
        userToken: accessToken,
        tools: availableTools,
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

          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: `${realToolName} is being called...\n`,
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
