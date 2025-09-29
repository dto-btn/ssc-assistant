/**
 * ChatMessages component
 *
 * Responsible for rendering the list of chat message items in the playground.
 * Handles message grouping, quoting highlights, and feeds message UI events
 * back to the store.
 */
import React, { useRef, useEffect, useMemo } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { Box, List, ListItem, ListItemText, IconButton, Paper } from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { setQuotedText } from "../store/slices/quotedSlice";
import ReactMarkdown from "react-markdown";
import Link from "@mui/material/Link";
import { tt } from "../i18n/tt";

interface ChatMessagesProps {
  sessionId: string;
}

interface MessageList extends Message {
  id: string;
}

const MarkdownLink: React.FC<React.ComponentPropsWithoutRef<"a">> = ({ children, ...rest }) => {
  return (
    <Link component="a" {...rest} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
  // Select a stable reference from the store
  const allMessages = useSelector((state: RootState) => state.chat.messages);

  // Derive the filtered list with useMemo to keep a stable reference
  const messages = useMemo(
    () => allMessages.filter((message) => message.sessionId === sessionId),
    [allMessages, sessionId]
  );

  const listRef = useRef<HTMLUListElement>(null);
  const dispatch = useDispatch();

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Box flex={1} overflow="auto" p={2}>
      <List ref={listRef}>
        {(messages as MessageList[]).map((message) => (
          <ListItem
            key={message.id}
            alignItems="flex-start"
            secondaryAction={
              message.role === "user" ? (
                <IconButton
                  size="small"
                  onClick={() => dispatch(setQuotedText(message.content || ""))}
                  title={tt("quote.this.message")}
                  aria-label={tt("quote.this.message")}
                >
                  <FormatQuoteIcon />
                </IconButton>
              ) : undefined
            }
          >
            <ListItemText
              primary={message.role === "user" ? "You" : "Assistant"}
              secondary={
                <>
                  <ReactMarkdown
                    components={{
                      a: ({ node, ref: _ref, ...props }) => (
                        <MarkdownLink {...(props as React.ComponentPropsWithoutRef<"a">)} />
                      ),
                    }}
                  >
                    {message.content}
                  </ReactMarkdown>
                  {message.attachments && message.attachments.length > 0 && (
                    <Paper variant="outlined" sx={{ mt: 1, p: 1 }}>
                      {tt("attachments")}: {message.attachments.length}
                    </Paper>
                  )}
                </>
              }
              // Ensure no block-level markdown (e.g., blockquote) is nested inside a <p>
              primaryTypographyProps={{ component: "span" }}
              secondaryTypographyProps={{ component: "div" }}
            />
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default ChatMessages;