import React from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import Toolbar from "./Toolbar";
import ReplayStopBar from "./ReplayStopBar";
import Citations from "./Citations";
import { Box, Typography } from "@mui/material";
import { addMessage, setIsLoading } from "../store/slices/chatSlice";
import Suggestions from "./Sugesstions";

const ChatArea: React.FC = () => {
  const dispatch = useDispatch();
  const currentSessionId = useSelector(
    (state: RootState) => state.sessions.currentSessionId
  );
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const messages = useSelector((state: RootState) =>
    state.chat.messages.filter((m) => m.sessionId === currentSessionId)
  );

  // Find citations from the last assistant message
  const lastAssistantMsg = [...messages].reverse().find((m) => m.role === "assistant");
  const citations = lastAssistantMsg?.citations || [];

  // Replay sends the previous user message again
  const handleReplay = () => {
    if (messages.length < 2) return;
    // Last user message before the last assistant response
    const lastUserMsgIdx = [...messages]
      .reverse()
      .findIndex((m) => m.role === "user");
    if (lastUserMsgIdx === -1) return;
    const userMsg =
      messages[messages.length - 2 - lastUserMsgIdx];
    if (userMsg) {
      dispatch(
        addMessage({
          sessionId: currentSessionId,
          role: "user",
          content: userMsg.content,
          attachments: userMsg.attachments,
        })
      );
    }
  };

  // Stop sets loading to false (simulate abort)
  const handleStop = () => {
    dispatch(setIsLoading(false));
  };

  // Suggestions logic
  const handleSuggestion = (suggestion: string) => {
    dispatch(
      addMessage({
        sessionId: currentSessionId!,
        role: "user",
        content: suggestion,
      })
    );
  };

  if (!currentSessionId) {
    return (
      <Box flex={1} display="flex" alignItems="center" justifyContent="center">
        Select or create a chat session to begin.
      </Box>
    );
  }
  if (messages.length === 0) {
    return (
      <Box flex={1} display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={6}>
        <Typography variant="h3" gutterBottom>How can I help?</Typography>
        <Suggestions onSuggestionClicked={handleSuggestion} disabled={isLoading} />
        <ChatInput sessionId={currentSessionId} />
      </Box>
    );
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" height="100vh">
      <Toolbar />
      <ChatMessages sessionId={currentSessionId} />
      <Citations citations={citations} />
      <ReplayStopBar
        onReplay={handleReplay}
        onStop={handleStop}
        isLoading={isLoading}
        disabled={messages.length < 2}
      />
      <ChatInput sessionId={currentSessionId} />
    </Box>
  );
};

export default ChatArea;