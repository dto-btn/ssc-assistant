import React, { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import type { RootState, AppDispatch } from "../store"; // Ensure AppDispatch is exported
import { Box, List, ListItem, ListItemText, IconButton, Paper } from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { setQuotedText } from "../store/slices/quotedSlice";
import ReactMarkdown from "react-markdown";
import Link from "@mui/material/Link";

interface ChatMessagesProps {
  sessionId: string;
}

// Replace with your actual message shape from the store if available
type ChatMessageRole = "user" | "assistant";
export interface ChatMessage {
  id: string;
  sessionId: string;
  role: ChatMessageRole;
  content: string;
  attachments?: ReadonlyArray<unknown>;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
  const dispatch = useDispatch<AppDispatch>();

  const messages = useSelector<RootState, ChatMessage[]>((state) =>
    state.chat.messages.filter(
      (message: ChatMessage) => message.sessionId === sessionId
    )
  );

  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Box flex={1} overflow="auto" p={2}>
      <List ref={listRef}>
        {messages.map((message) => (
          <ListItem
            key={message.id}
            alignItems="flex-start"
            secondaryAction={
              message.role === "user"
                ? (
                  <IconButton
                    size="small"
                    onClick={() => dispatch(setQuotedText(message.content))}
                    title="Quote this message"
                    aria-label="Quote this message"
                  >
                    <FormatQuoteIcon />
                  </IconButton>
                )
                : undefined
            }
          >
            <ListItemText
              primary={message.role === "user" ? "You" : "Assistant"}
              secondary={
                <>
                  <ReactMarkdown
                    components={{
                      a: ({  ...props }) => (
                        <Link {...props} target="_blank" rel="noopener" />
                      ),
                      p: ({ ...props }) => <span {...props} />,
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {message.attachments && message.attachments.length > 0 && (
                    <Paper variant="outlined" sx={{ mt: 1, p: 1 }}>
                      Attachments: {message.attachments.length}
                    </Paper>
                  )}
                </>
              }
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ChatMessages;