/**
 * ChatMessages component
 *
 * Responsible for rendering the list of chat message items in the playground.
 * Handles message grouping, quoting highlights, and feeds message UI events
 * back to the store.
 */
import React, { useRef, useEffect, useMemo, useCallback, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "../store";
import {
  Box,
  Link,
  List,
  ListItem,
} from "@mui/material";
import ReactMarkdown from "react-markdown";
import { useTranslation } from "react-i18next";
import AttachmentPreview from "./AttachmentPreview";
import { selectSessionFilesById } from "../store/selectors/sessionFilesSelectors";
import { FileAttachment } from "../types";
import { Message, MessageMcpAttribution } from "../store/slices/chatSlice";
import McpAttributionPill from "./McpAttributionPill";
import MarkdownCodeBlock, { MarkdownCodeBlockProps } from "./MarkdownCodeBlock";
import { ASSISTANT_MARKDOWN_SX, USER_MARKDOWN_SX } from "./chatMessageStyles";
import assistantLogo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import Citations from "./Citations";
import CitationDrawer from "./CitationDrawer";
import {
  groupCitationsByUrl,
  processTextWithCitations,
  safeDecodeUri,
} from "../utils/citations";

interface ChatMessagesProps {
  sessionId: string;
}

interface AssistantMessageBubbleProps {
  message: Message;
  pulseThisAssistantIcon: boolean;
  shouldShowThinkingLabel: boolean;
  liveAttribution?: MessageMcpAttribution;
  resolvedAttachments: FileAttachment[];
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

const AssistantMessageBubble: React.FC<AssistantMessageBubbleProps> = ({
  message,
  pulseThisAssistantIcon,
  shouldShowThinkingLabel,
  liveAttribution,
  resolvedAttachments,
}) => {
  const { t } = useTranslation("playground");
  const [isCitationDrawerOpen, setCitationDrawerOpen] = useState(false);
  const [activeCitationGroupUrl, setActiveCitationGroupUrl] = useState<string | undefined>(undefined);
  const [pendingCitationNumber, setPendingCitationNumber] = useState<number | undefined>(undefined);

  const allCitations = message.citations || [];
  const processedContent = useMemo(
    () => processTextWithCitations(message.content, allCitations),
    [message.content, allCitations],
  );

  const groupedCitations = useMemo(
    () => groupCitationsByUrl(
      processedContent.citedCitations,
      allCitations,
      processedContent.citationNumberMapping,
    ),
    [processedContent, allCitations],
  );

  const openCitationByUrl = useCallback(
    (url?: string, citationNumber?: number) => {
      if (!url || !groupedCitations.length) {
        return false;
      }

      const decoded = safeDecodeUri(url);
      const hasCitation = groupedCitations.some(
        (group) => safeDecodeUri(group.url) === decoded || encodeURI(group.url) === url,
      );

      if (!hasCitation) {
        return false;
      }

      setActiveCitationGroupUrl(decoded);
      if (citationNumber !== undefined) {
        setPendingCitationNumber(citationNumber);
      } else {
        setPendingCitationNumber(undefined);
      }
      setCitationDrawerOpen(true);
      return true;
    },
    [groupedCitations],
  );

  const markdownComponents = useMemo(
    () => ({
      a: ({ ...props }) => (
        <MarkdownLink
          {...(props as React.ComponentPropsWithoutRef<"a">)}
          onClick={(event) => {
            if (event.ctrlKey || event.metaKey || event.button === 1) {
              return;
            }

            const href = props.href;
            const citedNumber = Number.parseInt(
              (event.currentTarget.textContent || "").trim(),
              10,
            );
            const hasNumber = Number.isFinite(citedNumber);

            if (href && openCitationByUrl(href, hasNumber ? citedNumber : undefined)) {
              event.preventDefault();
            }

            props.onClick?.(event);
          }}
        />
      ),
      code: ({ ...props }) => (
        <MarkdownCodeBlock
          {...(props as MarkdownCodeBlockProps)}
        />
      ),
    }),
    [openCitationByUrl],
  );

  return (
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
          <Box sx={ASSISTANT_MARKDOWN_SX}>
            <ReactMarkdown components={markdownComponents}>
              {processedContent.processedText}
            </ReactMarkdown>
          </Box>
          {resolvedAttachments.length > 0 && (
            <AttachmentPreview attachments={resolvedAttachments} />
          )}
        </Box>
      </Box>
      <Citations
        groupedCitations={groupedCitations}
        onCitationClick={(group) => {
          setActiveCitationGroupUrl(group.url);
          setPendingCitationNumber(group.displayNumber);
          setCitationDrawerOpen(true);
        }}
      />
      <CitationDrawer
        open={isCitationDrawerOpen}
        onClose={() => setCitationDrawerOpen(false)}
        groupedCitations={groupedCitations}
        allCitations={allCitations}
        citationNumberMapping={processedContent.citationNumberMapping}
        assistantMessageContent={message.content}
        activeCitationGroupUrl={activeCitationGroupUrl}
        onActiveCitationGroupUrlChange={setActiveCitationGroupUrl}
        pendingCitationNumber={pendingCitationNumber}
        onPendingCitationNumberChange={setPendingCitationNumber}
      />
    </Box>
  );
};

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
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
                <AssistantMessageBubble
                  message={message}
                  pulseThisAssistantIcon={pulseThisAssistantIcon}
                  shouldShowThinkingLabel={shouldShowThinkingLabel}
                  liveAttribution={liveAttribution}
                  resolvedAttachments={resolvedAttachments}
                />
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
                    <ReactMarkdown
                      components={{
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
                      }}
                    >
                      {message.content}
                    </ReactMarkdown>
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
