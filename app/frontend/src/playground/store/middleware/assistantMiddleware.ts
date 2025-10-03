/**
 * Assistant middleware
 *
 * Redux middleware that intercepts assistant-related actions and handles
 * AI completions using the stored access token from Redux.
 */

import { Middleware } from "@reduxjs/toolkit";
import { addMessage, setIsLoading, updateMessageContent } from "../slices/chatSlice";
import { addToast } from "../slices/toastSlice";
import { RootState } from "..";
import { CompletionService } from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";

// Helper function to convert messages to completion format
function convertMessagesToCompletionFormat(messages: any[]) {
  return messages.map(msg => ({
    role: msg.role as "system" | "user" | "assistant",
    content: msg.content
  }));
}

// Helper to get valid token with automatic refresh
async function getValidTokenFromState(store: any): Promise<string | null> {
  const state = store.getState();
  const { accessToken } = state.auth;

  console.log('Middleware: Checking token state:', { 
    hasToken: !!accessToken, 
    tokenLength: accessToken?.length || 0 
  });

  // If we have a valid token, return it
  if (accessToken && !isTokenExpired(accessToken)) {
    console.log('Middleware: Token is valid, using existing token');
    return accessToken;
  }

  // If token needs refresh, dispatch error for now
  // In a full implementation, you'd trigger token refresh here
  console.warn('Middleware: Token expired or missing, user needs to refresh page');
  return null;
}

// Enhanced assistant middleware with Redux token management
export const assistantMiddleware: Middleware<{}, RootState> = store => next => action => {
  // Process the action first
  const result = next(action);

  // Handle user messages by triggering AI completion
  if (addMessage.match(action) && action.payload.role === "user") {
    const { sessionId, content } = action.payload;
    
    // Set loading state
    store.dispatch(setIsLoading(true));

    // Trigger async completion
    (async () => {
      try {
        // Get valid token (with refresh if needed)
        const accessToken = await getValidTokenFromState(store);
        
        if (!accessToken) {
          store.dispatch(addToast({
            message: "Authentication required. Please refresh the page.",
            isError: true
          }));
          return;
        }

        const state = store.getState();
        
        // Get conversation messages for this session
        const sessionMessages = state.chat.messages
          .filter(msg => msg.sessionId === sessionId)
          .map(msg => ({ role: msg.role, content: msg.content }));

        // Add the new user message to the conversation
        sessionMessages.push({ role: "user", content });

        // Add empty assistant message that will be updated with streaming content
        store.dispatch(addMessage({
          sessionId,
          role: "assistant",
          content: "",
        }));
        
        // Get the ID of the just-created assistant message
        const currentState = store.getState();
        const assistantMessage = currentState.chat.messages
          .filter(msg => msg.sessionId === sessionId && msg.role === "assistant")
          .pop(); // Get the last assistant message for this session
        
        if (!assistantMessage) {
          throw new Error("Failed to create assistant message");
        }
        
        const assistantMessageId = assistantMessage.id;
        let accumulatedContent = "";

        // Call completion service with streaming using the stored token
        await CompletionService.createCompletion(
          convertMessagesToCompletionFormat(sessionMessages),
          {
            userToken: accessToken,
            model: "gpt-4o",
            onStreamChunk: (chunk: string) => {
              accumulatedContent += chunk;
              // Update the assistant message with accumulated content
              store.dispatch(updateMessageContent({
                messageId: assistantMessageId,
                content: accumulatedContent
              }));
            }
          }
        );

      } catch (error) {
        console.error("Completion failed:", error);
        
        // Add error message
        store.dispatch(addMessage({
          sessionId,
          role: "assistant",
          content: "Sorry, I encountered an error while processing your request. Please try again.",
        }));

        // Show error toast
        store.dispatch(addToast({
          message: error instanceof Error ? error.message : "An error occurred during completion",
          isError: true
        }));
      } finally {
        // Clear loading state
        store.dispatch(setIsLoading(false));
      }
    })();
  }

  return result;
};