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
  lazy,
  useMemo,
  useRef,
  Suspense,
  useState,
} from "react";
import { useSelector } from "react-redux";
import { Box, Button, Chip, CircularProgress, List, ListItem, Paper, Stack, Typography, useTheme } from "@mui/material";
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
import BusinessRequestCard from "../../components/BusinessRequests/BusinessRequestCard";
import BusinessRequestMetadata from "../../components/BusinessRequests/BusinessRequestMetadata";
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
import { transformToBusinessRequest } from "../../util/bits_utils";
import "highlight.js/styles/github.css";
import "./mermaidTheme.css";

const BusinessRequestTable = lazy(
  () => import("./BusinessRequestTable")
);

const MermaidDataGrid = lazy(
  () => import("./MermaidDataGrid")
);

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
  /** True only during waiting-first-token and drafting phases — hides the full body. */
  isPreStreamingPhase: boolean;
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
  isPreStreamingPhase: boolean;
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

interface BrMetadata {
  execution_time: number;
  results: number;
  total_rows: number;
  extraction_date: string;
}

interface BrQueryFilter {
  name: string;
  en?: string;
  fr?: string;
  operator?: string;
  value?: string | number;
}

interface BrQuery {
  query_filters?: BrQueryFilter[];
  status?: string;
  statuses?: string[];
}

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  january: 0,
  janvier: 0,
  february: 1,
  fevrier: 1,
  march: 2,
  april: 3,
  avril: 3,
  may: 4,
  mai: 4,
  june: 5,
  juin: 5,
  july: 6,
  juillet: 6,
  august: 7,
  aout: 7,
  september: 8,
  septembre: 8,
  october: 9,
  octobre: 9,
  november: 10,
  novembre: 10,
  december: 11,
  decembre: 11,
};

const normalizeForMatching = (value: string): string => {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
};

const formatIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};
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
  isPreStreamingPhase,
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
  const { t, i18n } = useTranslation("playground");
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

  const brData = useMemo(() => {
    if (!message.brArtifacts?.brData?.length) {
      return undefined;
    }

    return message.brArtifacts.brData.map((item) =>
      transformToBusinessRequest(item)
    );
  }, [message.brArtifacts?.brData]);

  // Diagnostic: log if brArtifacts exist but brData is undefined (edge case)
  if (
    process.env.NODE_ENV === "development"
    && message.brArtifacts
    && !brData
    && message.role === "assistant"
  ) {
    console.warn(
      "[ChatMessages] Message has brArtifacts but brData is undefined:",
      {
        messageId: message.id,
        brArtifactsKeys: Object.keys(message.brArtifacts),
        brDataRaw: message.brArtifacts.brData,
      }
    );
  }

  const brMetadata = useMemo(() => {
    const metadata = message.brArtifacts?.brMetadata;
    if (!metadata) {
      return undefined;
    }

    const executionTime = Number(metadata.execution_time);
    const results = Number(metadata.results);
    const totalRows = Number(metadata.total_rows);
    const extractionDate = metadata.extraction_date;

    if (!Number.isFinite(executionTime) || !Number.isFinite(results) || !Number.isFinite(totalRows)) {
      return undefined;
    }

    if (typeof extractionDate !== "string") {
      return undefined;
    }

    return {
      execution_time: executionTime,
      results,
      total_rows: totalRows,
      extraction_date: extractionDate,
    } as BrMetadata;
  }, [message.brArtifacts?.brMetadata]);

  const brSelectFields = useMemo(() => {
    const fields = message.brArtifacts?.brSelectFields?.fields;
    if (!fields || !Array.isArray(fields)) {
      return [];
    }

    return fields;
  }, [message.brArtifacts?.brSelectFields?.fields]);

  const brQuery = useMemo(() => {
    const query = message.brArtifacts?.brQuery;
    if (!query || typeof query !== "object") {
      return undefined;
    }

    return query as BrQuery;
  }, [message.brArtifacts?.brQuery]);

  // Hide markdown only when the grid is the final presentation AND streaming has finished.
  const shouldHideAssistantMarkdownForBrTable =
    Boolean(brData && brData.length > 1) && !isActiveStreamingAssistantMessage;
  const isFrench = i18n.language.toLowerCase().startsWith("fr");

  const fallbackBrQuery = useMemo(() => {
    const sourcePrompt = regenerateSourceMessage?.content;

    if (!sourcePrompt) {
      return undefined;
    }

    // Lightweight heuristic extraction to show likely filters when tool metadata is missing.
    const queryFilters: BrQueryFilter[] = [];
    const normalizedPrompt = normalizeForMatching(sourcePrompt);

    const monthMatch = normalizedPrompt.match(/\b(january|janvier|february|fevrier|march|april|avril|may|mai|june|juin|july|juillet|august|aout|september|septembre|october|octobre|november|novembre|december|decembre)\b(?:\s+(\d{4}))?/i);
    if (monthMatch) {
      const monthName = monthMatch[1].toLowerCase();
      const monthIndex = MONTH_INDEX_BY_NAME[monthName];
      const requestedYear = monthMatch[2] ? Number.parseInt(monthMatch[2], 10) : new Date().getUTCFullYear();
      if (Number.isInteger(monthIndex) && Number.isFinite(requestedYear)) {
        const start = new Date(Date.UTC(requestedYear, monthIndex, 1));
        const end = new Date(Date.UTC(requestedYear, monthIndex + 1, 0));
        queryFilters.push({
          name: "SUBMIT_DATE",
          en: "Date Submitted",
          fr: "Date de soumission",
          operator: ">=",
          value: formatIsoDate(start),
        });
        queryFilters.push({
          name: "SUBMIT_DATE",
          en: "Date Submitted",
          fr: "Date de soumission",
          operator: "<=",
          value: formatIsoDate(end),
        });
      }
    }

    const relativeWeeksMatch = normalizedPrompt.match(/\b(?:last|past)\s+(\d+)\s+weeks?\b|\b(?:au\s+cours\s+des?|dans\s+les?)\s+(\d+)\s+dernieres?\s+semaines?\b|\b(\d+)\s+dernieres?\s+semaines?\b/i);
    if (relativeWeeksMatch) {
      const weeks = Number.parseInt(relativeWeeksMatch[1] || relativeWeeksMatch[2] || relativeWeeksMatch[3], 10);
      if (Number.isFinite(weeks) && weeks > 0) {
        const start = new Date();
        start.setUTCDate(start.getUTCDate() - (weeks * 7));
        queryFilters.push({
          name: "SUBMIT_DATE",
          en: "Date Submitted",
          fr: "Date de soumission",
          operator: ">=",
          value: formatIsoDate(start),
        });
      }
    }

    const clientMatch = sourcePrompt.match(/\bclient\b\s+([A-Za-z0-9][A-Za-z0-9 '&().-]{1,100}?)(?=(?:\s+for\s+brs?|\s+for\s+the\s+month|\s+with\s+|\s+of\s+|\s+that\s+|\s+priority|\s+only|\s+pour\s+les?\s+d[oa]|\s+pour\s+le\s+mois|\s+de\s+priorit[ée]|\s+seulement|\s+provenant\s+du|\s+au\s+cours\s+des?|[,.;]|$))/i);
    if (clientMatch) {
      const clientCandidate = clientMatch[1].trim();
      if (clientCandidate.length > 0) {
        queryFilters.push({
          name: isFrench ? "RPT_GC_ORG_NAME_FR" : "RPT_GC_ORG_NAME_EN",
          en: "Client Name",
          fr: "Nom du client",
          operator: "=",
          value: clientCandidate,
        });
      }
    }

    const priorityMatch = normalizedPrompt.match(/\b(high|medium|low)\s+priority\b|\bpriority\b\s*(?:is|=)?\s*(high|medium|low)\b|\bpriorite\b\s*(?:est|=|de)?\s*(elevee|moyenne|faible)\b|\bpriorite\s+(elevee|moyenne|faible)\b/i);
    const priorityRaw = (priorityMatch?.[1] || priorityMatch?.[2] || priorityMatch?.[3] || priorityMatch?.[4] || "").toLowerCase();
    const normalizedPriority = ({
      high: "High",
      medium: "Medium",
      low: "Low",
      elevee: "High",
      moyenne: "Medium",
      faible: "Low",
    } as Record<string, string>)[priorityRaw];
    if (normalizedPriority) {
      queryFilters.push({
        name: isFrench ? "PRIORITY_FR" : "PRIORITY_EN",
        en: "Priority",
        fr: "Priorité",
        operator: "=",
        value: normalizedPriority,
      });
    }

    if (queryFilters.length === 0) {
      return undefined;
    }

    return { query_filters: queryFilters } as BrQuery;
  }, [isFrench, regenerateSourceMessage?.content]);

  const displayedBrQuery = useMemo(() => {
    if (!brQuery && !fallbackBrQuery) {
      return undefined;
    }

    const combinedFilters: BrQueryFilter[] = [];
    const seen = new Set<string>();
    const appendFilters = (filters: BrQueryFilter[] | undefined) => {
      if (!filters) {
        return;
      }
      for (const filter of filters) {
        const key = `${filter.name}|${filter.operator || "="}|${String(filter.value ?? "")}`;
        if (seen.has(key)) {
          continue;
        }
        seen.add(key);
        combinedFilters.push(filter);
      }
    };

    appendFilters(brQuery?.query_filters);
    appendFilters(fallbackBrQuery?.query_filters);

    // Preserve explicit tool metadata when available; use fallback only to fill missing fields.
    const mergedQuery: BrQuery = {
      ...(fallbackBrQuery || {}),
      ...(brQuery || {}),
    };

    if (combinedFilters.length > 0) {
      mergedQuery.query_filters = combinedFilters;
    }

    return mergedQuery;
  }, [brQuery, fallbackBrQuery]);

  const fallbackMermaidRows = useMemo(() => {
    if ((brData && brData.length > 0) || !hasMermaidFence) {
      return [] as Array<{ id: string; [key: string]: string | number }>;
    }

    const text = processedContent.processedText || "";
    const rows: Array<{ id: string; [key: string]: string | number }> = [];
    const seen = new Set<string>();

    const normalizeNodeToken = (value: string): string => {
      return value
        .replace(/[()[\]{}]/g, "")
        .replace(/^"|"$/g, "")
        .trim();
    };

    const addRow = (row: Record<string, string | number>) => {
      const key = JSON.stringify(row);
      // Deduplicate syntactically repeated lines so the table mirrors unique diagram facts.
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({ id: `${rows.length + 1}`, ...row });
      }
    };

    const addRowsFromLines = (lines: string[]) => {
      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
          continue;
        }

        // Ignore Mermaid block headers/directives that are not data rows.
        if (/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|xychart-beta)\b/i.test(line)) {
          continue;
        }

        const pieLineMatch = line.match(/^"(.+?)"\s*:\s*(-?\d+(?:\.\d+)?)$/);
        if (pieLineMatch) {
          addRow({ type: "metric", label: pieLineMatch[1].trim(), value: Number(pieLineMatch[2]) });
          continue;
        }

        const bulletCountMatch = line.match(/^(?:[-*]|\d+\.)\s*(.+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:brs?)?\s*$/i);
        if (bulletCountMatch) {
          addRow({ type: "metric", label: bulletCountMatch[1].trim(), value: Number(bulletCountMatch[2]) });
          continue;
        }

        const plainCountMatch = line.match(/^(.+?)\s*:\s*(-?\d+(?:\.\d+)?)\s*(?:brs?)?\s*$/i);
        if (plainCountMatch) {
          addRow({ type: "metric", label: plainCountMatch[1].trim(), value: Number(plainCountMatch[2]) });
          continue;
        }

        const sequenceMatch = line.match(/^(.+?)\s*(->>|-->>|->|-->|=>|==>|--x|--o)\s*(.+?)\s*:\s*(.+)$/);
        if (sequenceMatch) {
          addRow({
            type: "interaction",
            source: normalizeNodeToken(sequenceMatch[1]),
            relation: sequenceMatch[2],
            target: normalizeNodeToken(sequenceMatch[3]),
            message: sequenceMatch[4].trim(),
          });
          continue;
        }

        const labeledEdgeMatch = line.match(/^(.+?)\s*(-->|---|-.->|==>|===|<--|<-->)\|(.+?)\|\s*(.+)$/);
        if (labeledEdgeMatch) {
          addRow({
            type: "edge",
            source: normalizeNodeToken(labeledEdgeMatch[1]),
            relation: labeledEdgeMatch[2],
            label: labeledEdgeMatch[3].trim(),
            target: normalizeNodeToken(labeledEdgeMatch[4]),
          });
          continue;
        }

        const edgeMatch = line.match(/^(.+?)\s*(-->|---|-.->|==>|===|<--|<-->)\s*(.+)$/);
        if (edgeMatch) {
          addRow({
            type: "edge",
            source: normalizeNodeToken(edgeMatch[1]),
            relation: edgeMatch[2],
            target: normalizeNodeToken(edgeMatch[3]),
          });
          continue;
        }
      }
    };

    const mermaidBlockMatch = text.match(/```mermaid\s*([\s\S]*?)```/i);
    if (mermaidBlockMatch) {
      addRowsFromLines(mermaidBlockMatch[1].split("\n"));
    }

    if (rows.length < 2) {
      return [] as Array<{ id: string; [key: string]: string | number }>;
    }

    const structureCounts = new Map<string, number>();
    rows.forEach((row) => {
      const shape = Object.keys(row)
        .filter((key) => key !== "id")
        .sort()
        .join("|");
      structureCounts.set(shape, (structureCounts.get(shape) || 0) + 1);
    });

    const hasRepeatingStructure = Array.from(structureCounts.values()).some((count) => count > 1);
    if (!hasRepeatingStructure) {
      return [] as Array<{ id: string; [key: string]: string | number }>;
    }

    return rows;
  }, [brData, hasMermaidFence, processedContent.processedText]);

  const shouldShowMermaidToggle =
    hasMermaidFence
    && !isActiveStreamingAssistantMessage
    && !shouldHideAssistantMarkdownForBrTable
    && fallbackMermaidRows.length === 0;
  // Only blank the body during pre-streaming phases (waiting / drafting).
  // During the streaming phase the markdown streams naturally (typewriter effect).
  const shouldHideAssistantBodyWhileStreaming = isPreStreamingPhase;

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
          {!shouldHideAssistantBodyWhileStreaming && (
            <>
              {shouldShowMermaidToggle && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 0.5 }}>
                  <Button
                    size="small"
                    variant="text"
                    onClick={onToggleMermaidCodeView}
                    aria-pressed={isShowingMermaidCode}
                    sx={{
                      minWidth: 0,
                      px: 0.5,
                      textTransform: "none",
                      fontSize: "0.78rem",
                    }}
                  >
                    {isShowingMermaidCode
                      ? t("assistant.mermaid.viewDiagram")
                      : t("assistant.mermaid.viewCode")}
                  </Button>
                </Box>
              )}
              {!shouldHideAssistantMarkdownForBrTable && (
                <Box sx={ASSISTANT_MARKDOWN_SX}>
                  <MarkdownHooks
                    components={markdownComponents}
                    remarkPlugins={remarkPlugins}
                    rehypePlugins={rehypePlugins}
                  >
                    {processedContent.processedText}
                  </MarkdownHooks>
                </Box>
              )}
              {resolvedAttachments.length > 0 && (
                <AttachmentPreview attachments={resolvedAttachments} />
              )}
              {brData && brData.length > 1 && !isActiveStreamingAssistantMessage && (
                <Box sx={{ mt: 1 }}>
                  <Suspense fallback={<Box role="status" aria-live="polite" sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={24} /><Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>{t("loading")}</Box></Box>}>
                    <BusinessRequestTable
                      data={brData}
                      lang={i18n.language}
                      show_fields={brSelectFields}
                    />
                  </Suspense>
                </Box>
              )}
              {brData && brData.length === 1 && !isActiveStreamingAssistantMessage && (
                <Box sx={{ mt: 1 }}>
                  <BusinessRequestCard
                    data={brData[0]}
                    lang={i18n.language}
                  />
                </Box>
              )}
              {(!brData || brData.length === 0) && fallbackMermaidRows.length > 0 && !isActiveStreamingAssistantMessage && (
                <Suspense fallback={<Box role="status" aria-live="polite" sx={{ display: "flex", justifyContent: "center", py: 2 }}><CircularProgress size={24} /><Box component="span" sx={{ position: "absolute", width: 1, height: 1, overflow: "hidden", clip: "rect(0,0,0,0)", whiteSpace: "nowrap" }}>{t("loading")}</Box></Box>}>
                  <MermaidDataGrid rows={fallbackMermaidRows} />
                </Suspense>
              )}
              {brMetadata && !isActiveStreamingAssistantMessage && (
                <Box sx={{ mt: 1 }}>
                  <BusinessRequestMetadata metadata={brMetadata} />
                </Box>
              )}
              {displayedBrQuery && !isActiveStreamingAssistantMessage && (
                <Box sx={{ mt: 1 }}>
                  <Paper sx={{ backgroundColor: "white", padding: 1, width: "100%" }} elevation={1}>
                    <Typography variant="caption" gutterBottom sx={{ display: "block", mb: 1 }}>
                      {t("br.query.parameters")}
                    </Typography>
                    <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                      {displayedBrQuery.query_filters?.map((filter, index) => (
                        <Chip
                          key={`query-filter-${index}`}
                          label={`${isFrench ? (filter.fr || filter.name) : (filter.en || filter.name)} (${filter.name}) ${filter.operator || "="} ${String(filter.value ?? "")}`}
                          size="small"
                          variant="outlined"
                          color="primary"
                        />
                      ))}
                      {displayedBrQuery.status && (
                        <Chip
                          label={`${t("br.query.status", { defaultValue: "Status" })}: ${displayedBrQuery.status}`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                      {displayedBrQuery.statuses && Array.isArray(displayedBrQuery.statuses) && displayedBrQuery.statuses.length > 0 && (
                        <Chip
                          label={`${t("br.query.statuses", { defaultValue: "Statuses" })}: ${displayedBrQuery.statuses.join(", ")}`}
                          size="small"
                          variant="outlined"
                          color="secondary"
                        />
                      )}
                    </Stack>
                  </Paper>
                </Box>
              )}
            </>
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
      {!isActiveStreamingAssistantMessage && (
        <>
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
        </>
      )}
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
  isPreStreamingPhase,
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
          isPreStreamingPhase={isPreStreamingPhase}
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
                  edgeLabelBackground: "#eef2ff",
                },
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
          const isPreStreamingPhase = Boolean(
            isAssistantMessage
              && message.id === activeAssistantMessageId
              && (assistantResponsePhase === "waiting-first-token" || assistantResponsePhase === "drafting")
          );

          return (
            <ChatMessageRow
              key={message.id}
              message={message}
              pulseThisAssistantIcon={pulseThisAssistantIcon}
              assistantStatusLabel={assistantStatusLabel}
              isPreStreamingPhase={isPreStreamingPhase}
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
