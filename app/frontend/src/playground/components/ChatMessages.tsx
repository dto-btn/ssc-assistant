import React, { useRef, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import { Box, List, ListItem, ListItemText, IconButton, Paper } from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { setQuotedText } from "../store/slices/qoutedSlice";
import ReactMarkdown from "react-markdown";
import Link from "@mui/material/Link";

interface ChatMessagesProps {
  sessionId: string;
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
        {(messages as Message[]).map((msg) => (
          <ListItem key={msg.id} alignItems="flex-start" secondaryAction={
            msg.role === "user" ? (
              <IconButton
                size="small"
                onClick={() => dispatch(setQuotedText(msg.content))}
                title="Quote this message"
              >
                <FormatQuoteIcon />
              </IconButton>
            ) : undefined
          }>
            <ListItemText
              primary={msg.role === "user" ? "You" : "Assistant"}
              secondary={
                <>
                  <ReactMarkdown
                    components={{
                      a: ({node, ...props}) => <Link {...props} target="_blank" rel="noopener" />,
                      p: ({node, ...props}) => <span {...props} />
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {msg.attachments && msg.attachments.length > 0 && (
                    <Paper variant="outlined" sx={{ mt: 1, p: 1 }}>
                      Attachments: {msg.attachments.length}
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