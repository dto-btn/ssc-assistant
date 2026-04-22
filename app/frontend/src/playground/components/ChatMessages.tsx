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
  Button,
  List,
  ListItem,
} from "@mui/material";
import { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeMermaid from "rehype-mermaid";
import Link from "@mui/material/Link";
import { useTranslation } from "react-i18next";
import type { ElementContent } from "hast";
import type { Pluggable } from "unified";
import AttachmentPreview from "./AttachmentPreview";
import { selectSessionFilesById } from "../store/selectors/sessionFilesSelectors";
import { FileAttachment } from "../types";
import { Message } from "../store/slices/chatSlice";
import McpAttributionPill from "./McpAttributionPill";
import MarkdownCodeBlock, { MarkdownCodeBlockProps } from "./MarkdownCodeBlock";
import { ASSISTANT_MARKDOWN_SX, USER_MARKDOWN_SX } from "./chatMessageStyles";
import assistantLogo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import ResponseButtons from "./ResponseButtons";
import "highlight.js/styles/github.css";

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
  const { t } = useTranslation("playground");
  const [mermaidCodeViewByMessageId, setMermaidCodeViewByMessageId] = React.useState<Record<string, boolean>>({});
  const [hoveredMessageId, setHoveredMessageId] = React.useState<string | null>(null);

  const markdownComponents = useMemo(
    () => ({
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
      th: ({ children, ...props }: React.ComponentPropsWithoutRef<"th">) => (
        <th scope="col" {...props}>
          {children}
        </th>
      ),
    }),
    [],
  );

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
  const mermaidErrorText = t("assistant.mermaid.error");

  const baseRehypePlugins = useMemo<Pluggable[]>(() => [rehypeHighlight], []);
  const remarkPlugins = useMemo<Pluggable[]>(() => [remarkGfm], []);

  const mermaidRehypePlugin = useMemo<Pluggable>(
    () => ([
      rehypeMermaid,
      {
        errorFallback: (): ElementContent => ({
          type: "element",
          tagName: "div",
          properties: {
            className: ["mermaid-error"],
            role: "alert",
          },
          children: [{ type: "text", value: mermaidErrorText }],
        }),
      },
    ]),
    [mermaidErrorText],
  );

  const rehypePluginsWithMermaid = useMemo<Pluggable[]>(
    () => [...baseRehypePlugins, mermaidRehypePlugin],
    [baseRehypePlugins, mermaidRehypePlugin],
  );

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

  const toggleMermaidCodeView = useCallback((messageId: string) => {
    setMermaidCodeViewByMessageId((previous) => ({
      ...previous,
      [messageId]: !previous[messageId],
    }));
  }, []);

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
          const isActiveStreamingAssistantMessage = Boolean(
            isAssistantMessage
            && message.id === activeAssistantMessageId
            && shouldPulseAssistantIcon,
          );
          const hasMermaidFence = /```\s*mermaid\b/i.test(message.content);
          const isShowingMermaidCode = Boolean(mermaidCodeViewByMessageId[message.id]);
          const shouldRenderMermaid = isAssistantMessage
            && hasMermaidFence
            && !isActiveStreamingAssistantMessage
            && !isShowingMermaidCode;
          const messageRehypePlugins = (!isAssistantMessage || !shouldRenderMermaid)
            ? baseRehypePlugins
            : rehypePluginsWithMermaid;
          const liveAttribution = hasLiveAttribution ? message.mcpAttribution : undefined;
          const resolvedAttachments = resolveAttachments(
            message.attachments as FileAttachment[] | undefined,
          );
          return (
            <ListItem
              key={message.id}
              alignItems="flex-start"
              onMouseEnter={() => setHoveredMessageId(message.id)}
              onMouseLeave={() => setHoveredMessageId(null)}
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
                      {isAssistantMessage && hasMermaidFence && !isActiveStreamingAssistantMessage && (
                        <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
                          <Button
                            size="small"
                            variant="text"
                            onClick={() => toggleMermaidCodeView(message.id)}
                            aria-pressed={isShowingMermaidCode}
                            sx={{ minWidth: 0, px: 0.5, textTransform: "none", fontSize: "0.78rem" }}
                          >
                            {isShowingMermaidCode
                              ? t("assistant.mermaid.viewDiagram")
                              : t("assistant.mermaid.viewCode")}
                          </Button>
                        </Box>
                      )}
                      <Box sx={ASSISTANT_MARKDOWN_SX}>
                        <MarkdownHooks
                          components={markdownComponents}
                          remarkPlugins={remarkPlugins}
                          rehypePlugins={messageRehypePlugins}
                        >
                          {message.content}
                        </MarkdownHooks>
                      </Box>
                      {resolvedAttachments.length > 0 && (
                        <AttachmentPreview attachments={resolvedAttachments} />
                      )}
                      {!isActiveStreamingAssistantMessage && (
                        <ResponseButtons
                          isHovering={hoveredMessageId === message.id}
                          isMostRecent={message.id === activeAssistantMessageId}
                          text={message.content}
                          messageId={message.id}
                          isStreaming={shouldPulseAssistantIcon}
                        />
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
                  <Box sx={USER_MARKDOWN_SX}>
                    <MarkdownHooks
                      components={markdownComponents}
                      remarkPlugins={remarkPlugins}
                      rehypePlugins={messageRehypePlugins}
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
