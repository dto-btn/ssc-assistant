/**
 * ChatArea component
 *
 * Renders the main chat area for the playground including messages and
 * metadata such as citations and feedback controls. Exports a React
 * component used by `PlaygroundRoot`/`Playground`.
 */

import React from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store"; // Ensure AppDispatch is exported from your store
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import ReplayStopBar from "./ReplayStopBar";
import Citations from "./Citations";
import { Box, Typography } from "@mui/material";
import { addMessage, setIsLoading } from "../store/slices/chatSlice";
import Suggestions from "./Suggestions";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import { useTranslation } from 'react-i18next';
import { listSessionFiles } from "../api/storage";
import { setSessionFiles } from "../store/slices/sessionFilesSlice";

const ChatArea: React.FC = () => {
  const { t } = useTranslation('playground');
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useSelector(
    (state: RootState) => state.sessions.currentSessionId
  );
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);
  const accessToken = useSelector((state: RootState) => state.auth.accessToken);
  const loadedSessionsRef = React.useRef<Set<string>>(new Set());

  // Use memoized selector for messages
  const messages = useSelector(selectMessagesBySessionId);

  // Create a single reversed view to avoid repeated copying/reversal
  const reversedMessages = React.useMemo(
    () => [...messages].reverse(),
    [messages]
  );

  // Find citations from the last assistant message
  const lastAssistantMessage = reversedMessages.find(
    (message) => message.role === "assistant"
  );
  const citations = lastAssistantMessage?.citations ?? [];

  // Replay sends the previous user message again
  const handleReplay = (): void => {
    if (messages.length < 2) return;
    // Index of the last user message in the reversed array
    const lastUserMessageIndexFromEnd = reversedMessages.findIndex(
      (message) => message.role === "user"
    );
    if (lastUserMessageIndexFromEnd === -1) return;
    const userMessage =
      messages[messages.length - 2 - lastUserMessageIndexFromEnd];
    if (userMessage) {
      dispatch(
        addMessage({
          sessionId: currentSessionId!,
          role: "user",
          content: userMessage.content,
          attachments: userMessage.attachments,
        })
      );
    }
  };

  // Stop sets loading to false (simulate abort)
  const handleStop = (): void => {
    dispatch(setIsLoading(false));
  };

  // Suggestions logic
  const handleSuggestion = (suggestion: string): void => {
    dispatch(
      addMessage({
        sessionId: currentSessionId!,
        role: "user",
        content: suggestion,
      })
    );
  };

  React.useEffect(() => {
    if (!currentSessionId || !accessToken) return undefined;
    if (loadedSessionsRef.current.has(currentSessionId)) return undefined;

    let cancelled = false;
    (async () => {
      try {
        const files = await listSessionFiles({ sessionId: currentSessionId, accessToken });
        if (cancelled) return;
        dispatch(setSessionFiles({ sessionId: currentSessionId, files }));
        loadedSessionsRef.current.add(currentSessionId);
      } catch (error) {
        if (!cancelled) {
          // eslint-disable-next-line no-console
          console.error("Failed to load session files", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, accessToken, dispatch]);

  if (!currentSessionId) {
    return (
      <Box flex={1} display="flex" alignItems="center" justifyContent="center">
        {t("select.or.create.session")}
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        alignItems="center"
        justifyContent="center"
        p={6}
      >
        <Typography variant="h3" gutterBottom>
          {t("how.can.i.help")}
        </Typography>
        <Suggestions
          onSuggestionClicked={handleSuggestion}
          disabled={isLoading}
        />
        <ChatInput sessionId={currentSessionId} />
      </Box>
    );
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" height="100vh">
      <ChatMessages sessionId={currentSessionId} />
      <Citations citations={citations as Citation[]} />
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