import React, { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { Box, List, ListItem, ListItemText, IconButton, Paper } from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { setQuotedText } from "../store/slices/quotedSlice";
import ReactMarkdown from "react-markdown";
import Link from "@mui/material/Link";

interface ChatMessagesProps {
  sessionId: string;
}

interface MessageList extends Message {
  id: string;
}

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
  const messages = useSelector((state: RootState) =>
    state.chat.messages.filter((m) => m.sessionId === sessionId)
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
          <ListItem key={message.id} alignItems="flex-start" secondaryAction={
            message.role === "user" ? (
              <IconButton
                size="small"
                onClick={() => dispatch(setQuotedText(message.content || ""))}
                title="Quote this message"
              >
                <FormatQuoteIcon />
              </IconButton>
            ) : undefined
          }>
            <ListItemText
              primary={message.role === "user" ? "You" : "Assistant"}
              secondary={
                <>
                  <ReactMarkdown
                    components={{
                      a: ({ ...props}) => <Link {...props} target="_blank" rel="noopener" />,
                      p: ({ ...props}) => <span {...props} />
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