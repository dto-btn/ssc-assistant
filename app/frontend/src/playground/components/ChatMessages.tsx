/**
 * ChatMessages component
 *
 * Responsible for rendering the list of chat message items in the playground.
 * Handles message grouping, quoting highlights, and feeds message UI events
 * back to the store.
 */
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSelector } from "react-redux";
import { Box, Button, List, ListItem } from "@mui/material";
import { useTheme } from "@mui/material/styles";
import Link from "@mui/material/Link";
import { MarkdownHooks } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import rehypeMermaid from "rehype-mermaid";
import { useTranslation } from "react-i18next";
import type { ElementContent } from "hast";
import type { Pluggable } from "unified";
import type { RootState } from "../store";
import AttachmentPreview from "./AttachmentPreview";
import Citations from "./Citations";
import CitationDrawer from "./CitationDrawer";
import McpAttributionPill from "./McpAttributionPill";
import MarkdownCodeBlock, { type MarkdownCodeBlockProps } from "./MarkdownCodeBlock";
import ResponseButtons from "./ResponseButtons";
import { ASSISTANT_MARKDOWN_SX, USER_MARKDOWN_SX } from "./chatMessageStyles";
import assistantLogo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { selectSessionFilesById } from "../store/selectors/sessionFilesSelectors";
import type { Message, MessageMcpAttribution } from "../store/slices/chatSlice";
import type { FileAttachment } from "../types";
import {
  groupCitationsByUrl,
  processTextWithCitations,
  safeDecodeUri,
} from "../utils/citations";
import { selectMessagesForSession } from "../store/selectors/chatSelectors";
import "highlight.js/styles/github.css";
import "./mermaidTheme.css";

interface ChatMessagesProps {
  sessionId: string;
}

interface AssistantMessageBubbleProps {
  message: Message;
  pulseThisAssistantIcon: boolean;
  assistantStatusLabel?: string;
  liveAttribution?: MessageMcpAttribution;
  hasMermaidFence: boolean;
  isActiveStreamingAssistantMessage: boolean;
  isShowingMermaidCode: boolean;
  isHovering: boolean;
  isMostRecent: boolean;
  regenerateSourceMessage?: Pick<Message, "content" | "attachments">;
  sessionId: string;
  onToggleMermaidCodeView: () => void;
  remarkPlugins: Pluggable[];
  rehypePlugins: Pluggable[];
  resolvedAttachments: FileAttachment[];
}

interface ChatMessageRowProps {
  message: Message;
  pulseThisAssistantIcon: boolean;
  assistantStatusLabel?: string;
  isMostRecent: boolean;
  regenerateSourceMessage?: Pick<Message, "content" | "attachments">;
  isShowingMermaidCode: boolean;
  onToggleMermaidCodeView: (messageId: string) => void;
  remarkPlugins: Pluggable[];
  baseRehypePlugins: Pluggable[];
  rehypePluginsWithMermaid: Pluggable[];
  sessionId: string;
  sessionFilesByBlobName: Map<string, FileAttachment>;
}

const getPlainText = (children: React.ReactNode): string => {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === "string" || typeof child === "number") {
        return String(child);
      }

      if (React.isValidElement<{ children?: React.ReactNode }>(child)) {
        return getPlainText(child.props.children);
      }

      return "";
    })
    .join("");
};

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

const AssistantMessageBubble: React.FC<AssistantMessageBubbleProps> = React.memo(({
  message,
  pulseThisAssistantIcon,
  assistantStatusLabel,
  liveAttribution,
  hasMermaidFence,
  isActiveStreamingAssistantMessage,
  isShowingMermaidCode,
  isHovering,
  isMostRecent,
  regenerateSourceMessage,
  sessionId,
  onToggleMermaidCodeView,
  remarkPlugins,
  rehypePlugins,
  resolvedAttachments,
}) => {
  const { t } = useTranslation("playground");
  const theme = useTheme();
  const [isCitationDrawerOpen, setCitationDrawerOpen] = useState(false);
  const [activeCitationGroupUrl, setActiveCitationGroupUrl] = useState<
    string | undefined
  >(undefined);
  const [pendingCitationNumber, setPendingCitationNumber] = useState<
    number | undefined
  >(undefined);

  const allCitations = useMemo(() => message.citations ?? [], [message.citations]);
  const processedContent = useMemo(
    () => processTextWithCitations(message.content, allCitations),
    [message.content, allCitations]
  );

  const groupedCitations = useMemo(
    () =>
      groupCitationsByUrl(
        processedContent.citedCitations,
        allCitations,
        processedContent.citationNumberMapping
      ),
    [processedContent, allCitations]
  );

  const getCitationGroupByNumber = useCallback(
    (citationNumber?: number) => {
      if (citationNumber === undefined || !groupedCitations.length) {
        return undefined;
      }

      return groupedCitations.find((group) =>
        group.citations.some((citation) => {
          const citationIndex = allCitations.findIndex((entry) => entry === citation);
          if (citationIndex < 0) {
            return false;
          }

          return processedContent.citationNumberMapping[citationIndex + 1] === citationNumber;
        })
      );
    },
    [allCitations, groupedCitations, processedContent.citationNumberMapping]
  );

  const getCitationGroupByUrl = useCallback(
    (url?: string) => {
      if (!url || !groupedCitations.length) {
        return undefined;
      }

      const decodedUrl = safeDecodeUri(url);
      return groupedCitations.find((group) => {
        const normalizedGroupUrl = safeDecodeUri(group.url);
        return normalizedGroupUrl === decodedUrl || encodeURI(group.url) === url;
      });
    },
    [groupedCitations]
  );

  const openCitationGroup = useCallback(
    (url?: string, citationNumber?: number) => {
      const matchingGroup =
        getCitationGroupByNumber(citationNumber)
        ?? getCitationGroupByUrl(url);

      if (!matchingGroup) {
        return false;
      }

      setActiveCitationGroupUrl(matchingGroup.url);
      setPendingCitationNumber(citationNumber);
      setCitationDrawerOpen(true);
      return true;
    },
    [getCitationGroupByNumber, getCitationGroupByUrl]
  );

  const markdownComponents = useMemo(
    () => ({
      a: ({ children, ...props }: React.ComponentPropsWithoutRef<"a">) => {
        const href = props.href;
        const citedText = getPlainText(children).trim();
        const isCitationLabel = /^\d+$/.test(citedText);
        const citedNumber = isCitationLabel
          ? Number.parseInt(citedText, 10)
          : undefined;
        const citationGroup =
          getCitationGroupByNumber(citedNumber)
          ?? getCitationGroupByUrl(href);

        if (citationGroup && citedNumber !== undefined) {
          return (
            <Link
              component="button"
              type="button"
              underline="always"
              aria-label={t("citations.inline.openNumber", {
                defaultValue: "Open citation {{number}} details",
                number: citedNumber,
              })}
              aria-haspopup="dialog"
              aria-controls="citation-drawer"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                openCitationGroup(href, citedNumber);
              }}
              sx={{
                p: 0,
                border: 0,
                minWidth: 0,
                background: "none",
                color: "#4B3FA8",
                font: "inherit",
                fontWeight: 500,
                cursor: "pointer",
                verticalAlign: "baseline",
              }}
            >
              {children}
            </Link>
          );
        }

        return <MarkdownLink {...props}>{children}</MarkdownLink>;
      },
      code: ({ ...props }) => (
        <MarkdownCodeBlock {...(props as MarkdownCodeBlockProps)} />
      ),
      th: ({ children, ...props }: React.ComponentPropsWithoutRef<"th">) => (
        <th scope="col" {...props}>
          {children}
        </th>
      ),
    }),
    [getCitationGroupByNumber, getCitationGroupByUrl, openCitationGroup, t]
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
          <McpAttributionPill attribution={liveAttribution} messageId={message.id} />
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
          {pulseThisAssistantIcon && assistantStatusLabel && (
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
              {assistantStatusLabel}
            </Box>
          )}
        </Box>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {hasMermaidFence && !isActiveStreamingAssistantMessage && (
            <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
              <Button
                size="small"
                variant="contained"
                onClick={onToggleMermaidCodeView}
                aria-pressed={isShowingMermaidCode}
                sx={{
                  minWidth: 0,
                  px: 1,
                  py: 0.25,
                  textTransform: "none",
                  fontSize: "0.78rem",
                  borderRadius: 999,
                  backgroundColor:
                    theme.palette.mode === "dark" ? "rgba(120, 132, 180, 0.22)" : "rgba(75, 62, 153, 0.08)",
                  color:
                    theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.primary.main,
                  boxShadow: "none",
                  "&:hover": {
                    backgroundColor:
                      theme.palette.mode === "dark" ? "rgba(140, 152, 201, 0.32)" : "rgba(75, 62, 153, 0.14)",
                    boxShadow: "none",
                  },
                }}
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
              rehypePlugins={rehypePlugins}
            >
              {processedContent.processedText}
            </MarkdownHooks>
          </Box>
          {resolvedAttachments.length > 0 && (
            <AttachmentPreview attachments={resolvedAttachments} />
          )}
          {!isActiveStreamingAssistantMessage && (
            <ResponseButtons
              isHovering={isHovering}
              isMostRecent={isMostRecent}
              text={message.content}
              messageId={message.id}
              isStreaming={pulseThisAssistantIcon}
              regenerateSourceMessage={regenerateSourceMessage}
              sessionId={sessionId}
              feedback={message.feedback}
            />
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
});

const resolveAttachmentsForMessage = (
  attachments: FileAttachment[] | undefined,
  sessionFilesByBlobName: Map<string, FileAttachment>,
): FileAttachment[] => {
  if (!attachments || attachments.length === 0) {
    return [];
  }

  if (!sessionFilesByBlobName.size) {
    return attachments;
  }

  return attachments.map((attachment) => {
    if (!attachment.blobName) {
      return attachment;
    }

    const resolvedAttachment = sessionFilesByBlobName.get(attachment.blobName);
    return resolvedAttachment ? { ...resolvedAttachment, ...attachment } : attachment;
  });
};

const ChatMessageRow: React.FC<ChatMessageRowProps> = React.memo(({
  message,
  pulseThisAssistantIcon,
  assistantStatusLabel,
  isMostRecent,
  regenerateSourceMessage,
  isShowingMermaidCode,
  onToggleMermaidCodeView,
  remarkPlugins,
  baseRehypePlugins,
  rehypePluginsWithMermaid,
  sessionId,
  sessionFilesByBlobName,
}) => {
  const [isHovering, setIsHovering] = useState(false);

  const isUserMessage = message.role === "user";
  const isAssistantMessage = message.role === "assistant";
  const hasMermaidFence = /```\s*mermaid\b/i.test(message.content);
  const isActiveStreamingAssistantMessage = Boolean(
    isAssistantMessage && isMostRecent && pulseThisAssistantIcon
  );
  const shouldRenderMermaid =
    isAssistantMessage
    && hasMermaidFence
    && !isActiveStreamingAssistantMessage
    && !isShowingMermaidCode;
  const messageRehypePlugins =
    !isAssistantMessage || !shouldRenderMermaid
      ? baseRehypePlugins
      : rehypePluginsWithMermaid;
  const liveAttribution =
    isAssistantMessage
    && message.mcpAttribution?.source === "live"
    && message.mcpAttribution.servers.length > 0
      ? message.mcpAttribution
      : undefined;
  const resolvedAttachments = useMemo(
    () => resolveAttachmentsForMessage(message.attachments as FileAttachment[] | undefined, sessionFilesByBlobName),
    [message.attachments, sessionFilesByBlobName]
  );
  const markdownComponents = useMemo(
    () => ({
      a: ({ ...props }: React.ComponentPropsWithoutRef<"a">) => (
        <MarkdownLink {...props} />
      ),
      code: ({ ...props }) => (
        <MarkdownCodeBlock {...(props as MarkdownCodeBlockProps)} />
      ),
      th: ({ children, ...props }: React.ComponentPropsWithoutRef<"th">) => (
        <th scope="col" {...props}>
          {children}
        </th>
      ),
    }),
    []
  );

  return (
    <ListItem
      key={message.id}
      alignItems="flex-start"
      onMouseEnter={() => setIsHovering(true)}
      onMouseLeave={() => setIsHovering(false)}
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
          assistantStatusLabel={assistantStatusLabel}
          liveAttribution={liveAttribution}
          hasMermaidFence={hasMermaidFence}
          isActiveStreamingAssistantMessage={isActiveStreamingAssistantMessage}
          isShowingMermaidCode={isShowingMermaidCode}
          isHovering={isHovering}
          isMostRecent={isMostRecent}
          regenerateSourceMessage={regenerateSourceMessage}
          sessionId={sessionId}
          onToggleMermaidCodeView={() => onToggleMermaidCodeView(message.id)}
          remarkPlugins={remarkPlugins}
          rehypePlugins={messageRehypePlugins}
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
});

const ChatMessages: React.FC<ChatMessagesProps> = ({ sessionId }) => {
  const { t } = useTranslation("playground");
  const theme = useTheme();
  const paletteMode = theme.palette.mode;
  const [mermaidCodeViewByMessageId, setMermaidCodeViewByMessageId] =
    useState<Record<string, boolean>>({});
  const assistantResponsePhase = useSelector(
    (state: RootState) => state.chat.assistantResponsePhaseBySessionId[sessionId]
  );
  const messages = useSelector((state: RootState) => selectMessagesForSession(state, sessionId));

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
    || assistantResponsePhase === "drafting"
    || assistantResponsePhase === "streaming";
  const assistantStatusLabel = assistantResponsePhase === "waiting-first-token"
    ? t("assistant.waiting")
    : assistantResponsePhase === "drafting"
      ? t("assistant.drafting")
      : undefined;
  const mermaidErrorText = t("assistant.mermaid.error");

  const baseRehypePlugins = useMemo<Pluggable[]>(() => [rehypeHighlight], []);
  const remarkPlugins = useMemo<Pluggable[]>(() => [remarkGfm], []);

  const mermaidRehypePlugin = useMemo<Pluggable>(
    () => [
      rehypeMermaid,
      {
        strategy: "inline-svg",
        mermaidConfig: {
          theme: paletteMode === "dark" ? "dark" : "default",
          themeVariables:
            paletteMode === "dark"
              ? {
                  background: "#1a1e29",
                  mainBkg: "#24304d",
                  secondBkg: "#1f2a44",
                  tertiaryColor: "#1f2757",
                  primaryColor: "#24304d",
                  primaryTextColor: "#f4f7ff",
                  secondaryTextColor: "#e7ecff",
                  tertiaryTextColor: "#f4f7ff",
                  textColor: "#f4f7ff",
                  lineColor: "#d6deff",
                  arrowheadColor: "#d6deff",
                  edgeLabelBackground: "#2b3c61",
                  nodeBorder: "#d6deff",
                }
              : {
                  background: "#f5f5f5",
                  mainBkg: "#ffffff",
                  secondBkg: "#f5f7ff",
                  tertiaryColor: "#e9edff",
                  primaryColor: "#ffffff",
                  primaryTextColor: "#11131a",
                  secondaryTextColor: "#11131a",
                  tertiaryTextColor: "#11131a",
                  textColor: "#11131a",
                  lineColor: "#4b3e99",
                  arrowheadColor: "#4b3e99",
                  edgeLabelBackground: "#eef2ff",
                  nodeBorder: "#4b3e99",
                },
          themeCSS:
            paletteMode === "dark"
              ? `
                  .edgeLabel rect,
                  rect.edgeLabel {
                    fill: #2b3c61 !important;
                    stroke: #d6deff !important;
                    stroke-width: 1px !important;
                  }
                  .edgeLabel text,
                  .edgeLabel tspan {
                    fill: #000000 !important;
                    font-weight: 600 !important;
                  }
                  .edgeLabel,
                  .edgeLabel *,
                  .edgeLabel foreignObject div,
                  .edgeLabel foreignObject span {
                    color: #000000 !important;
                  }
                  .edgePath .path,
                  .flowchart-link {
                    stroke: #d6deff !important;
                    fill: none !important;
                  }
                  .arrowheadPath {
                    fill: #d6deff !important;
                    stroke: #d6deff !important;
                  }
                  .node rect,
                  .node polygon,
                  .node circle,
                  .node ellipse,
                  .node path {
                    fill: #24304d !important;
                    stroke: #d6deff !important;
                  }
                  .nodeLabel,
                  .nodeLabel *,
                  .label,
                  .label *,
                  text,
                  tspan {
                    fill: #f4f7ff !important;
                    color: #f4f7ff !important;
                  }
                `
              : undefined,
        },
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
    ],
    [mermaidErrorText, paletteMode]
  );

  const rehypePluginsWithMermaid = useMemo<Pluggable[]>(
    () => [...baseRehypePlugins, mermaidRehypePlugin],
    [baseRehypePlugins, mermaidRehypePlugin]
  );

  const scrollRef = useRef<HTMLDivElement>(null);
  const sessionFiles = useSelector(selectSessionFilesById(sessionId));

  const sessionFilesByBlobName = useMemo(
    () => new Map(
      sessionFiles
        .filter((file) => Boolean(file.blobName))
        .map((file) => [file.blobName as string, file])
    ),
    [sessionFiles]
  );

  const regenerateSourceByAssistantId = useMemo(() => {
    let latestUserMessage: Message | undefined;
    const sourceByAssistantId: Record<string, Message | undefined> = {};

    messages.forEach((message) => {
      if (message.role === "user") {
        latestUserMessage = message;
        return;
      }

      if (message.role === "assistant") {
        sourceByAssistantId[message.id] = latestUserMessage;
      }
    });

    return sourceByAssistantId;
  }, [messages]);

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
          const isAssistantMessage = message.role === "assistant";
          const pulseThisAssistantIcon = Boolean(
            isAssistantMessage
              && shouldPulseAssistantIcon
              && message.id === activeAssistantMessageId
          );

          return (
            <ChatMessageRow
              key={message.id}
              message={message}
              pulseThisAssistantIcon={pulseThisAssistantIcon}
              assistantStatusLabel={assistantStatusLabel}
              isMostRecent={message.id === activeAssistantMessageId}
              regenerateSourceMessage={regenerateSourceByAssistantId[message.id]}
              isShowingMermaidCode={Boolean(mermaidCodeViewByMessageId[message.id])}
              onToggleMermaidCodeView={toggleMermaidCodeView}
              remarkPlugins={remarkPlugins}
              baseRehypePlugins={baseRehypePlugins}
              rehypePluginsWithMermaid={rehypePluginsWithMermaid}
              sessionId={sessionId}
              sessionFilesByBlobName={sessionFilesByBlobName}
            />
          );
        })}
      </List>
    </Box>
  );
};

export default ChatMessages;
