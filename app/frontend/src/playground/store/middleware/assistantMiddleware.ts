import { Middleware } from "@reduxjs/toolkit";
import { addMessage, setIsLoading } from "../slices/chatSlice";
import { RootState } from "..";

// Simulate an assistant response with streaming and citations
export const assistantMiddleware: Middleware<{}, RootState> = store => next => action => {
   if (addMessage.match(action) && action.payload.role === "user") {
      if (action.type === addMessage.type && action.payload.role === "user") {
        const { sessionId, content } = action.payload;
        store.dispatch(setIsLoading(true));
        setTimeout(() => {
          // Simulate citation detection
          const citations =
            content.includes("github")
              ? [{ title: "GitHub", url: "https://github.com/" }]
              : undefined;
          store.dispatch(
            addMessage({
              sessionId,
              role: "assistant",
              content: `Echo: ${content}`,
              citations,
            })
          );
          store.dispatch(setIsLoading(false));
        }, 700);
      }
  }
  return next(action);
};