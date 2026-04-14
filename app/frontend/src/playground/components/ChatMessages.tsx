/**
 * ChatMessages component
 *
 * Responsible for rendering the list of chat message items in the playground.
 * Handles message grouping, quoting highlights, and feeds message UI events
 * back to the store.
 */
import React, { useRef, useEffect, useMemo, useCallback } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  Box,
  List,
  ListItem,
} from "@mui/material";
import { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeMermaid from "rehype-mermaid";
import rehypeMathjax from "rehype-mathjax";
import "highlight.js/styles/github.css";
import Link from "@mui/material/Link";
import { useTranslation } from "react-i18next";
import AttachmentPreview from "./AttachmentPreview";
import { selectSessionFilesById } from "../store/selectors/sessionFilesSelectors";
import { FileAttachment } from "../types";
import { Message } from "../store/slices/chatSlice";
import McpAttributionPill from "./McpAttributionPill";
import MarkdownCodeBlock, { MarkdownCodeBlockProps } from "./MarkdownCodeBlock";
import { ASSISTANT_MARKDOWN_SX, USER_MARKDOWN_SX } from "./chatMessageStyles";
import assistantLogo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";

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

interface MarkdownCodeBlockProps extends React.ComponentPropsWithoutRef<"code"> {
  inline?: boolean;
}

const getNodeText = (node: React.ReactNode): string => {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(getNodeText).join("");
  if (React.isValidElement<{ children?: React.ReactNode }>(node)) {
    return getNodeText(node.props.children);
  }
  return "";
};

const MarkdownCodeBlock: React.FC<MarkdownCodeBlockProps> = ({
  inline,
  className,
  children,
  ...rest
}) => {
  const [isCopied, setIsCopied] = useState(false);
  const codeText = useMemo(() => getNodeText(children).replace(/\n$/, ""), [children]);

  const handleCopyCode = async () => {
    if (!codeText) return;
    try {
      await navigator.clipboard.writeText(codeText);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1400);
    } catch {
      // Clipboard API may be unavailable in some browser contexts.
    }
  };

  if (inline) {
    return (
      <code className={className} {...rest}>
        {children}
      </code>
    );
  }

  return (
    <Box sx={{ position: "relative" }}>
      <Tooltip title={isCopied ? "Copied" : "Copy code"}>
        <IconButton
          size="small"
          aria-label="Copy code"
          onClick={handleCopyCode}
          sx={{
            position: "absolute",
            top: 8,
            right: 8,
            bgcolor: "rgba(255,255,255,0.86)",
            border: "1px solid rgba(0,0,0,0.12)",
            zIndex: 1,
            "&:hover": { bgcolor: "rgba(255,255,255,0.96)" },
          }}
        >
          {isCopied ? <CheckIcon fontSize="inherit" /> : <ContentCopyIcon fontSize="inherit" />}
        </IconButton>
      </Tooltip>
      <pre className={className} style={{ margin: 0 }}>
        <code {...rest}>{children}</code>
      </pre>
    </Box>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
  const { t } = useTranslation("playground");
  const baseMarkdownSx = {
    fontSize: "0.98rem",
    lineHeight: 1.65,
    wordBreak: "break-word",
    "& > *:first-of-type": { mt: 0 },
    "& > *:last-child": { mb: 0 },
    "& p": { m: 0 },
    "& p + p": { mt: 1.25 },
    "& h1, & h2, & h3, & h4": { mt: 1.5, mb: 0.75, lineHeight: 1.3 },
    "& ul, & ol": { my: 1, pl: 3 },
    "& li + li": { mt: 0.4 },
    "& code": {
      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
      fontSize: "0.88em",
      px: 0.5,
      py: 0.2,
      borderRadius: "6px",
      bgcolor: "rgba(0,0,0,0.06)",
    },
    "& pre": {
      my: 1.25,
      p: 1.25,
      borderRadius: "10px",
      overflowX: "auto",
      bgcolor: "rgba(0,0,0,0.06)",
    },
    "& pre code": {
      bgcolor: "transparent",
      p: 0,
      borderRadius: 0,
      fontSize: "0.86em",
    },
    "& blockquote": {
      m: 0,
      my: 1,
      pl: 1.25,
      borderLeft: "3px solid",
      borderColor: "rgba(75,63,168,0.45)",
      color: "text.secondary",
    },
    "& table": {
      width: "100%",
      borderCollapse: "collapse",
      my: 1.25,
      fontSize: "0.92em",
    },
    "& th, & td": {
      border: "1px solid rgba(0,0,0,0.16)",
      p: 0.65,
      textAlign: "left",
      verticalAlign: "top",
    },
    "& a": {
      textUnderlineOffset: "2px",
    },
    "& svg[id^='mermaid-']": {
      width: "100% !important",
      height: "auto !important",
      maxWidth: "100%",
      display: "block",
      margin: "0 auto",
      minHeight: "420px",
    },
  };

  const assistantMarkdownSx = {
    ...baseMarkdownSx,
    "& a": {
      color: "#4B3FA8",
      fontWeight: 500,
    },
  };

  const userMarkdownSx = {
    ...baseMarkdownSx,
    "& code": {
      ...baseMarkdownSx["& code"],
      bgcolor: "rgba(255,255,255,0.2)",
    },
    "& pre": {
      ...baseMarkdownSx["& pre"],
      bgcolor: "rgba(255,255,255,0.2)",
    },
    "& blockquote": {
      ...baseMarkdownSx["& blockquote"],
      borderColor: "rgba(255,255,255,0.55)",
      color: "rgba(255,255,255,0.92)",
    },
    "& th, & td": {
      ...baseMarkdownSx["& th, & td"],
      border: "1px solid rgba(255,255,255,0.35)",
    },
    "& a": {
      color: "#FFFFFF",
      fontWeight: 500,
    },
  };

  const markdownComponents = {
    a: ({ ...props }) => (
      <MarkdownLink
        {...(props as React.ComponentPropsWithoutRef<"a">)}
      />
    ),
    code: ({ ...props }) => (
      <MarkdownCodeBlock
        {...(props as MarkdownCodeBlockProps)}
      />
    ),
  };

  const remarkPlugins = [remarkGfm];

  // Select a stable reference from the store
  const allMessages = useSelector((state: RootState) => state.chat.messages);
  const assistantResponsePhase = useSelector(
    (state: RootState) => state.chat.assistantResponsePhaseBySessionId[sessionId],
  );

  // Derive the filtered list with useMemo to keep a stable reference
  const messages = useMemo(
    () => allMessages.filter((message) => message.sessionId === sessionId),
    [allMessages, sessionId]
  );

  const activeAssistantMessageId = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "assistant") {
        return messages[index].id;
      }
    }
    return null;
  }, [messages]);

  const shouldPulseAssistantIcon =
    assistantResponsePhase === "waiting-first-token"
    || assistantResponsePhase === "streaming";
  const shouldShowThinkingLabel = assistantResponsePhase === "waiting-first-token";

  const scrollRef = useRef<HTMLDivElement>(null);
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  return (
    <Box ref={scrollRef} flex={1} overflow="auto" p={2}>
      <List
        sx={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          width: "100%",
        }}
      >
        {messages.map((message: Message) => {
          const isUserMessage = message.role === "user";
          const isAssistantMessage = message.role === "assistant";
          const pulseThisAssistantIcon = Boolean(
            isAssistantMessage
            && shouldPulseAssistantIcon
            && message.id === activeAssistantMessageId,
          );
          const hasLiveAttribution = isAssistantMessage
            && message.mcpAttribution?.source === "live"
            && message.mcpAttribution.servers.length > 0;
          const liveAttribution = hasLiveAttribution ? message.mcpAttribution : undefined;
          const isActiveStreamingAssistant = Boolean(
            isAssistantMessage
            && message.id === activeAssistantMessageId
            && assistantResponsePhase === "streaming",
          );
          const resolvedAttachments = resolveAttachments(
            message.attachments as FileAttachment[] | undefined,
          );
          return (
            <ListItem
              key={message.id}
              alignItems="flex-start"
              sx={{
                px: 0,
                py: 1,
                width: "100%",
                maxWidth: { xs: "100%", md: "980px" },
                justifyContent: isUserMessage ? "flex-end" : "flex-start",
              }}
            >
              {isAssistantMessage ? (
                <Box sx={{ width: { xs: "min(100%, 680px)", lg: "800px" }, maxWidth: "100%" }}>
                  {liveAttribution && (
                    <Box
                      sx={{
                        display: "flex",
                        justifyContent: "flex-end",
                        alignItems: "flex-start",
                        mb: 0.75,
                        width: "100%",
                      }}
                    >
                      <McpAttributionPill
                        attribution={liveAttribution}
                        messageId={message.id}
                      />
                    </Box>
                  )}
                  <Box sx={{ display: "flex", alignItems: "flex-start", gap: 1 }}>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 0.75, flexShrink: 0 }}>
                      <Box
                        component="img"
                        src={assistantLogo}
                        alt={t("assistant.label")}
                        sx={{
                          "@keyframes assistantIconPulse": {
                            "0%": { transform: "scale(1)", opacity: 1 },
                            "50%": { transform: "scale(1.08)", opacity: 0.78 },
                            "100%": { transform: "scale(1)", opacity: 1 },
                          },
                          mt: 0.1,
                          width: 26,
                          height: 26,
                          borderRadius: "50%",
                          flexShrink: 0,
                          animation: pulseThisAssistantIcon
                            ? "assistantIconPulse 1.2s ease-in-out infinite"
                            : "none",
                          "@media (prefers-reduced-motion: reduce)": {
                            animation: "none",
                          },
                        }}
                      />
                      {pulseThisAssistantIcon && shouldShowThinkingLabel && (
                        <Box
                          component="span"
                          role="status"
                          aria-live="polite"
                          aria-atomic="true"
                          sx={{
                            fontSize: "0.86rem",
                            color: "text.secondary",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {t("assistant.waiting")}
                        </Box>
                      )}
                    </Box>
                    <Box sx={{ minWidth: 0, flex: 1 }}>
                      <Box sx={assistantMarkdownSx}>
                        <MarkdownHooks
                          components={markdownComponents}
                          remarkPlugins={remarkPlugins}
                          rehypePlugins={
                            isActiveStreamingAssistant
                              ? [rehypeHighlight, rehypeMathjax]
                              : [
                                rehypeHighlight,
                                rehypeMathjax,
                                [
                                  rehypeMermaid,
                                  {
                                    errorFallback: () => <div>Invalid diagram format!</div>,
                                  },
                                ],
                              ]
                          }
                        >
                          {message.content}
                        </MarkdownHooks>
                      </Box>
                      {resolvedAttachments.length > 0 && (
                        <AttachmentPreview attachments={resolvedAttachments} />
                      )}
                    </Box>
                  </Box>
                </Box>
              ) : (
                <Box
                  sx={{
                    minWidth: 0,
                    width: "fit-content",
                    maxWidth: "88%",
                    px: 1.5,
                    py: 1.1,
                    bgcolor: "#4B3FA8",
                    color: "#FFFFFF",
                    borderRadius: "16px 4px 16px 16px",
                  }}
                >
                  <Box sx={userMarkdownSx}>
                    <MarkdownHooks
                      components={markdownComponents}
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={[
                        rehypeHighlight,
                        rehypeMathjax,
                        [
                          rehypeMermaid,
                          {
                            errorFallback: () => <div>Invalid diagram format!</div>,
                          },
                        ],
                      ]}
                    >
                      {message.content}
                    </MarkdownHooks>
                  </Box>
                  {resolvedAttachments.length > 0 && (
                    <AttachmentPreview attachments={resolvedAttachments} />
                  )}
                </Box>
              )}
            </ListItem>
          );
        })}
      </List>
    </Box>
  );
};

export default ChatMessages;
