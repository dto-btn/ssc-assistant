import React, { Fragment, useEffect, useRef } from "react";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Drawer,
  IconButton,
  Link,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useTranslation } from "react-i18next";
import { Citation, GroupedCitation } from "../utils/citations";

interface CitationDrawerProps {
  open: boolean;
  onClose: () => void;
  groupedCitations: GroupedCitation[];
  allCitations: Citation[];
  citationNumberMapping: Record<number, number>;
  assistantMessageContent: string;
  activeCitationGroupUrl?: string;
  onActiveCitationGroupUrlChange: (url?: string) => void;
  pendingCitationNumber?: number;
  onPendingCitationNumberChange: (value?: number) => void;
}

/**
 * Expand grouped citations and optionally jump to the citation number that was
 * clicked inline in the assistant response.
 */
const CitationDrawer: React.FC<CitationDrawerProps> = ({
  open,
  onClose,
  groupedCitations,
  allCitations,
  citationNumberMapping,
  assistantMessageContent,
  activeCitationGroupUrl,
  onActiveCitationGroupUrlChange,
  pendingCitationNumber,
  onPendingCitationNumberChange,
}) => {
  const { t } = useTranslation("playground");
  const theme = useTheme();
  const isSmall = useMediaQuery(theme.breakpoints.down("md"));
  const citationScrollRef = useRef<HTMLDivElement | null>(null);

  const normalizeUrl = (url: string): string => {
    try {
      return decodeURI(url);
    } catch {
      return url;
    }
  };

  const normalizeComparableText = (value: string): string => {
    return value
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  };

  const normalizedAssistantMessageContent = normalizeComparableText(assistantMessageContent || "");

  const isInternalCitationUrl = (url: string): boolean => {
    return url.startsWith("local-citation://");
  };

  const formatSourceLabel = (url: string): string => {
    if (isInternalCitationUrl(url)) {
      return t("citations.localSourceReference", {
        defaultValue: "Local source reference",
      });
    }
    return url;
  };

  const getCitationSourceTitle = (citation: Citation, group: GroupedCitation): string => {
    const sourceTitle = citation.title?.trim() || group.title?.trim() || "";
    if (!sourceTitle || sourceTitle === group.url) {
      return formatSourceLabel(group.url);
    }
    return sourceTitle;
  };

  const getGroupDisplayTitle = (group: GroupedCitation): string => {
    const title = group.title?.trim() || "";
    if (!title || title === group.url) {
      return formatSourceLabel(group.url);
    }
    return title;
  };

  const isLikelyResponseEcho = (value?: string): boolean => {
    if (!value) {
      return false;
    }

    const normalized = normalizeComparableText(value);
    if (!normalized || normalized.length < 24) {
      return false;
    }

    return normalizedAssistantMessageContent.includes(normalized);
  };

  const getSourceLikeScore = (value: string): number => {
    const normalized = value.trim();
    if (!normalized) {
      return Number.NEGATIVE_INFINITY;
    }

    let score = Math.min(normalized.length, 600);
    if (/\n/.test(normalized)) {
      score += 140;
    }
    if (/\b(page|annex|unclassified|project management|authoritative data source)\b/i.test(normalized)) {
      score += 180;
    }
    if (/mailto:|https?:\/\//i.test(normalized)) {
      score += 60;
    }
    return score;
  };

  // Providers sometimes repeat the assistant's answer text in each citation.
  // Prefer the richest non-echo excerpt so the drawer stays source-focused.
  const pickBestGroupSourceExcerpt = (group: GroupedCitation): string | undefined => {
    const candidates = group.citations
      .map((entry) => entry.content)
      .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
      .map((entry) => entry.trim());

    if (!candidates.length) {
      return undefined;
    }

    const nonEchoCandidates = candidates.filter((entry) => !isLikelyResponseEcho(entry));
    const pool = nonEchoCandidates.length > 0 ? nonEchoCandidates : candidates;

    return pool.sort((a, b) => getSourceLikeScore(b) - getSourceLikeScore(a))[0];
  };

  const getCitationDetailText = (citation: Citation, group: GroupedCitation): string => {
    const ownContent = citation.content?.trim();
    if (ownContent && !isLikelyResponseEcho(ownContent)) {
      return ownContent;
    }

    const bestGroupExcerpt = pickBestGroupSourceExcerpt(group);
    if (bestGroupExcerpt) {
      return bestGroupExcerpt;
    }

    if (ownContent) {
      return ownContent;
    }

    if (citation.title && citation.title !== group.url) {
      return t("citations.sourceDocument", {
        defaultValue: "Source document: {{title}}",
        title: citation.title,
      });
    }

    return t("citations.sourceLocation", {
      defaultValue: "Source location: {{location}}",
      location: formatSourceLabel(group.url),
    });
  };

  /**
   * Recover the display number assigned in the rendered message so drawer
   * entries line up with inline citation markers.
   */
  const getMappedCitationNumber = (citation: Citation): number | undefined => {
    const fullIndex = allCitations.findIndex(
      (entry) =>
        entry === citation
        || (
          normalizeUrl(entry.url) === normalizeUrl(citation.url)
          && entry.title === citation.title
          && entry.content === citation.content
          && entry.startIndex === citation.startIndex
          && entry.endIndex === citation.endIndex
        ),
    );
    if (fullIndex < 0) {
      return undefined;
    }

    return citationNumberMapping[fullIndex + 1];
  };

  useEffect(() => {
    if (!open || pendingCitationNumber === undefined) {
      return;
    }

    const targetId = `citation-${pendingCitationNumber}`;

    const scrollToCitation = () => {
      const element = document.getElementById(targetId);
      if (!element) {
        return false;
      }

      const container =
        citationScrollRef.current
        || (element.closest("[data-citation-scroll]") as HTMLElement)
        || (element.parentElement as HTMLElement | null);

      if (container) {
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        const targetTop = container.scrollTop + (rect.top - containerRect.top) - 40;
        const top = Math.max(0, targetTop);
        if (typeof container.scrollTo === "function") {
          container.scrollTo({ top, behavior: "smooth" });
        } else {
          container.scrollTop = top;
        }
      } else {
        element.scrollIntoView({ behavior: "smooth", block: "start", inline: "nearest" });
      }

      onPendingCitationNumberChange(undefined);
      return true;
    };

    if (scrollToCitation()) {
      return;
    }

    // Accordions mount lazily, so retry once after paint when the requested
    // citation card is not yet attached to the DOM.
    const timer = window.setTimeout(() => {
      scrollToCitation();
    }, 80);

    return () => window.clearTimeout(timer);
  }, [open, pendingCitationNumber, onPendingCitationNumberChange, activeCitationGroupUrl]);

  return (
    <Drawer
      anchor={isSmall ? "bottom" : "right"}
      open={open}
      onClose={onClose}
      ModalProps={{ keepMounted: true }}
      transitionDuration={0}
      PaperProps={{
        id: "citation-drawer",
        role: "dialog",
        "aria-labelledby": "citation-drawer-title",
        sx: {
          width: isSmall ? "100%" : 420,
          maxWidth: "100%",
          maxHeight: isSmall ? "85vh" : "100%",
        },
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          p: 1,
          pl: 2,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography id="citation-drawer-title" variant="subtitle1">
          {t("citations.drawer.title", { defaultValue: "Citations" })}
        </Typography>
        <IconButton
          id="close-citation-drawer-button"
          aria-label={t("citations.drawer.close", {
            defaultValue: "Close citations",
          })}
          onClick={onClose}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <Box sx={{ p: 1 }}>
        {groupedCitations.map((group) => (
          <Accordion
            key={group.url}
            // Keep this Accordion fully controlled with a strict boolean expanded value
            // to avoid controlled/uncontrolled switching warnings.
            expanded={
              activeCitationGroupUrl
                ? activeCitationGroupUrl === group.url
                : undefined
            }
            onChange={(_, expanded) => {
              if (expanded) {
                onActiveCitationGroupUrlChange(group.url);
              } else {
                onActiveCitationGroupUrlChange(undefined);
              }
            }}
          >
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography
                variant="subtitle2"
                sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
              >
                {getGroupDisplayTitle(group)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Typography
                variant="caption"
                sx={{ color: "text.secondary", overflowWrap: "anywhere" }}
              >
                {t("citations.source", { defaultValue: "Source:" })}{" "}
                {isInternalCitationUrl(group.url) ? (
                  <Typography component="span" variant="caption">
                    {formatSourceLabel(group.url)}
                  </Typography>
                ) : (
                  <Link
                    href={encodeURI(group.url)}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={t("citations.source.openExternal", {
                      defaultValue: "Open source in a new tab: {{title}}",
                      title: formatSourceLabel(group.url),
                    })}
                    sx={{ overflowWrap: "anywhere", wordBreak: "break-word" }}
                  >
                    {formatSourceLabel(group.url)}
                  </Link>
                )}
              </Typography>
              <Box
                sx={{
                  mt: 1,
                  maxHeight: isSmall ? 240 : 520,
                  overflow: "auto",
                  pr: 1,
                }}
                ref={
                  activeCitationGroupUrl === group.url
                    ? citationScrollRef
                    : undefined
                }
                data-citation-scroll
              >
                {group.citations.map((citation, index) => {
                  const mappedNumber = getMappedCitationNumber(citation);
                  return (
                    <Fragment key={`${group.url}-${index}`}>
                      {mappedNumber !== undefined && (
                        <Typography
                          component="span"
                          variant="subtitle1"
                          sx={{
                            fontWeight: 600,
                            display: "block",
                            mb: 0.5,
                          }}
                        >
                          {mappedNumber}.
                        </Typography>
                      )}
                      <Box
                        sx={{
                          mb: 1.5,
                          p: 1.5,
                          borderRadius: 1,
                          bgcolor: "#f4f1ff",
                          border: "1px solid #e1dbff",
                          scrollMarginTop: 80,
                        }}
                        id={
                          mappedNumber
                            ? `citation-${mappedNumber}`
                            : undefined
                        }
                      >
                        <Typography
                          variant="caption"
                          sx={{
                            color: "text.secondary",
                            display: "block",
                            mb: 0.5,
                            overflowWrap: "anywhere",
                            wordBreak: "break-word",
                          }}
                        >
                          {t("citations.source", { defaultValue: "Source:" })}{" "}
                          {getCitationSourceTitle(citation, group)}
                        </Typography>
                        <Typography
                          variant="body2"
                          sx={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                        >
                          {getCitationDetailText(citation, group)}
                        </Typography>
                      </Box>
                    </Fragment>
                  );
                })}
              </Box>
            </AccordionDetails>
          </Accordion>
        ))}
      </Box>
    </Drawer>
  );
};

export default CitationDrawer;