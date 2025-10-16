/**
 * ChatMessages component
 *
 * Responsible for rendering the list of chat message items in the playground.
 * Handles message grouping, quoting highlights, and feeds message UI events
 * back to the store.
 */
import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import {
  Box,
  List,
  ListItem,
  ListItemText,
  IconButton,
} from "@mui/material";
import FormatQuoteIcon from "@mui/icons-material/FormatQuote";
import { setQuotedText } from "../store/slices/quotedSlice";
import ReactMarkdown from "react-markdown";
import Link from "@mui/material/Link";
import { useTranslation } from 'react-i18next';
import AttachmentPreview from "./AttachmentPreview";
import { selectSessionFilesById } from "../store/selectors/sessionFilesSelectors";
import { FileAttachment } from "../types";
import { Message } from "../store/slices/chatSlice";

interface ChatMessagesProps {
  sessionId: string;
}

const MarkdownLink: React.FC<React.ComponentPropsWithoutRef<"a">> = ({
  children,
  ...rest
}) => {
  return (
    <Link component="a" {...rest} target="_blank" rel="noopener noreferrer">
      {children}
    </Link>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
  const { t } = useTranslation('playground');

  // Select a stable reference from the store
  const allMessages = useSelector((state: RootState) => state.chat.messages);

  // Derive the filtered list with useMemo to keep a stable reference
  const messages = useMemo(
    () => allMessages.filter((message) => message.sessionId === sessionId),
    [allMessages, sessionId]
  );

  const listRef = useRef<HTMLUListElement>(null);
  const dispatch = useDispatch();
  const sessionFiles = useSelector(selectSessionFilesById(sessionId));

  // Merge lightweight attachment stubs from the transcript with any richer
  // metadata fetched from storage so previews stay up-to-date.
  const resolveAttachments = useCallback(
    (attachments?: FileAttachment[]): FileAttachment[] => {
      if (!attachments || attachments.length === 0) return [];
      if (!sessionFiles.length) return attachments;
      return attachments.map((attachment) => {
        if (!attachment.blobName) return attachment;
        const match = sessionFiles.find((file) => file.blobName === attachment.blobName);
        return match ? { ...match, ...attachment } : attachment;
      });
    },
    [sessionFiles]
  );

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Box flex={1} overflow="auto" p={2}>
      <List ref={listRef}>
        {messages.map((message: Message) => {
          const resolvedAttachments = resolveAttachments(
            message.attachments as FileAttachment[] | undefined,
          );
          return (
            <ListItem
              key={message.id}
              alignItems="flex-start"
              secondaryAction={
                message.role === "user" ? (
                  <IconButton
                    size="small"
                    onClick={() => dispatch(setQuotedText(message.content || ""))}
                    title={t("quote.this.message")}
                    aria-label={t("quote.this.message")}
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
                        a: ({ ...props }) => (
                          <MarkdownLink
                            {...(props as React.ComponentPropsWithoutRef<"a">)}
                          />
                        ),
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
                    {resolvedAttachments.length > 0 && (
                      <AttachmentPreview attachments={resolvedAttachments} />
                    )}
                  </>
                }
                slotProps={{
                  primary: { component: "span" },
                  secondary: { component: "div" },
                }}
              />
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default ChatMessages;
