/**
 * ResponseButtons component
 *
 * Renders copy, regenerate, like, and dislike action buttons beneath an
 * assistant message in the playground. Designed to be WCAG 2.1 AA compliant
 * and responsive across all screen sizes.
 *
 * - Copy: writes the message text to the clipboard and shows a brief
 *   confirmation icon for 3 seconds.
 * - Regenerate: removes the current assistant + preceding user message pair and
 *   calls sendAssistantMessage to get a fresh response. All three Redux
 *   dispatches (delete × 2, sendAssistantMessage's sync setIsLoading +
 *   setPhase) are batched by React 18 into a single render, so the UI jumps
 *   directly from the old response to the loading state with no flicker.
 * - Like / Dislike: immediately submits feedback via `submitResponseFeedback`
 *   (no modal). The pressed button stays visually active; clicking the same
 *   button again deselects it. Like and dislike are mutually exclusive.
 *
 * On desktop the buttons are shown when the parent message is hovered or
 * focused. On touch devices (`isMobile`) they are always visible because
 * hover events are unreliable on touchscreens.
 */

import React, { useCallback, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Tooltip, Box, IconButton, useTheme, useMediaQuery } from "@mui/material";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import { CopyToClipboard } from "react-copy-to-clipboard";
import { useTranslation } from "react-i18next";
import type { AppDispatch, RootState } from "../store";
import { submitResponseFeedback } from "../store/thunks/feedbackThunks";
import { deleteMessage } from "../store/slices/chatSlice";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import { sendAssistantMessage } from "../store/thunks/assistantThunks";

interface ResponseButtonsProps {
  /** Whether the parent message row is currently hovered. */
  isHovering: boolean;
  /** Whether this message is the most recent assistant response. */
  isMostRecent: boolean;
  /** Plain-text content of the message, written to the clipboard on copy. */
  text: string;
  /** Message ID, used as the feedback UUID. */
  messageId: string;
  /** Whether the assistant is actively streaming a response. */
  isStreaming: boolean;
}

type FeedbackState = "none" | "liked" | "disliked";

const BRAND_COLOR = "#4b3e99";
const COPY_RESET_MS = 3000;

/** sx applied to every IconButton — ensures a 44×44 touch target (WCAG 2.5.5) */
const baseIconButtonSx = {
  borderRadius: "6px",
  padding: "10px",
  minWidth: 44,
  minHeight: 44,
  // Custom hover background that works alongside MUI's ripple
  "&:hover": {
    backgroundColor: "rgba(75, 62, 153, 0.08)",
  },
  // Visible focus ring for keyboard navigation (WCAG 2.4.7)
  "&.Mui-focusVisible": {
    outline: `2px solid ${BRAND_COLOR}`,
    outlineOffset: "2px",
    backgroundColor: "rgba(75, 62, 153, 0.08)",
  },
} as const;

/** Additional sx for an actively-pressed like/dislike button */
const activeFeedbackSx = {
  ...baseIconButtonSx,
  backgroundColor: "rgba(75, 62, 153, 0.12)",
  "&:hover": {
    backgroundColor: "rgba(75, 62, 153, 0.18)",
  },
} as const;

const ResponseButtons: React.FC<ResponseButtonsProps> = React.memo(
  ({ isHovering, isMostRecent, text, messageId, isStreaming }) => {
    const { t } = useTranslation("playground");
    const dispatch = useDispatch<AppDispatch>();
    const theme = useTheme();
    // On touch devices there is no reliable hover, so always show buttons
    const isMobile = useMediaQuery(theme.breakpoints.down("md"));

    const messages = useSelector(selectMessagesBySessionId);
    const currentSessionId = useSelector(
      (state: RootState) => state.sessions.currentSessionId,
    );

    const [isCopied, setIsCopied] = useState(false);
    const [isFocused, setIsFocused] = useState(false);
    const [feedbackState, setFeedbackState] = useState<FeedbackState>("none");

    // Buttons are visible when the row is hovered/focused, it is the most
    // recent response, or we are on a touch device (no hover available).
    const isVisible = isHovering || isMostRecent || isMobile || isFocused;
    const iconColor = isVisible ? BRAND_COLOR : "transparent";

    useEffect(() => {
      if (!isCopied) return undefined;
      const timer = setTimeout(() => setIsCopied(false), COPY_RESET_MS);
      return () => clearTimeout(timer);
    }, [isCopied]);

    const handleCopied = useCallback(() => setIsCopied(true), []);

    const handleFocus = useCallback(() => setIsFocused(true), []);
    const handleBlur = useCallback(() => setIsFocused(false), []);

    /**
     * Delete the stale assistant + user message pair and re-send via
     * `sendAssistantMessage`. All dispatches are synchronous before any await,
     * so React 18 batches them into one render — the UI transitions directly
     * from the old response to the loading state with no intermediate flash.
     */
    const handleRegenerate = useCallback(() => {
      if (!currentSessionId) return;

      const assistantIdx = messages.findIndex((m) => m.id === messageId);
      if (assistantIdx === -1) return;

      // Find the closest user message above this assistant turn.
      let userIdx = -1;
      for (let i = assistantIdx - 1; i >= 0; i--) {
        if (messages[i].role === "user") {
          userIdx = i;
          break;
        }
      }
      if (userIdx === -1) return;

      const userMessage = messages[userIdx];

      // Only remove the stale assistant message — the user question stays
      // visible. skipUserMessage tells sendAssistantMessage not to re-add it,
      // preventing a duplicate user turn from appearing.
      dispatch(deleteMessage(messageId));

      void dispatch(
        sendAssistantMessage({
          sessionId: currentSessionId,
          content: userMessage.content,
          attachments: userMessage.attachments,
          skipUserMessage: true,
        }),
      );
    }, [currentSessionId, dispatch, messageId, messages]);

    const handleLike = useCallback(() => {
      const next: FeedbackState = feedbackState === "liked" ? "none" : "liked";
      setFeedbackState(next);
      if (next !== "none") {
        dispatch(submitResponseFeedback(messageId, true));
      }
    }, [dispatch, feedbackState, messageId]);

    const handleDislike = useCallback(() => {
      const next: FeedbackState = feedbackState === "disliked" ? "none" : "disliked";
      setFeedbackState(next);
      if (next !== "none") {
        dispatch(submitResponseFeedback(messageId, false));
      }
    }, [dispatch, feedbackState, messageId]);

    const isLiked = feedbackState === "liked";
    const isDisliked = feedbackState === "disliked";

    return (
      // aria-live="polite" announces copy-state changes to screen readers
      // without interrupting ongoing speech (WCAG 4.1.3)
      <Box
        component="span"
        aria-live="polite"
        sx={{ display: "inline-flex", alignItems: "center", mt: 0.5 }}
      >
        <CopyToClipboard text={text} onCopy={handleCopied}>
          <Tooltip title={isCopied ? t("copy.success") : t("copy")} arrow>
            <IconButton
              aria-label={isCopied ? t("copy.success") : t("copy")}
              aria-pressed={isCopied}
              size="small"
              sx={baseIconButtonSx}
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              {isCopied ? (
                <CheckIcon sx={{ fontSize: 20, color: BRAND_COLOR }} />
              ) : (
                <ContentCopyIcon sx={{ fontSize: 20, color: iconColor }} />
              )}
            </IconButton>
          </Tooltip>
        </CopyToClipboard>

        {/* Regenerate — only on the most recent non-streaming response */}
        {isMostRecent && !isStreaming && (
          <Tooltip title={t("regenerate")} arrow>
            <IconButton
              aria-label={t("regenerate")}
              size="small"
              onClick={handleRegenerate}
              sx={baseIconButtonSx}
              onFocus={handleFocus}
              onBlur={handleBlur}
            >
              <RefreshIcon sx={{ fontSize: 20, color: iconColor }} />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title={t("good.response")} arrow>
          <IconButton
            aria-label={t("good.response")}
            aria-pressed={isLiked}
            size="small"
            onClick={handleLike}
            sx={isLiked ? activeFeedbackSx : baseIconButtonSx}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            {isLiked ? (
              <ThumbUpAltIcon sx={{ fontSize: 20, color: BRAND_COLOR }} />
            ) : (
              <ThumbUpAltOutlinedIcon sx={{ fontSize: 20, color: iconColor }} />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip title={t("bad.response")} arrow>
          <IconButton
            aria-label={t("bad.response")}
            aria-pressed={isDisliked}
            size="small"
            onClick={handleDislike}
            sx={isDisliked ? activeFeedbackSx : baseIconButtonSx}
            onFocus={handleFocus}
            onBlur={handleBlur}
          >
            {isDisliked ? (
              <ThumbDownAltIcon sx={{ fontSize: 20, color: BRAND_COLOR }} />
            ) : (
              <ThumbDownAltOutlinedIcon sx={{ fontSize: 20, color: iconColor }} />
            )}
          </IconButton>
        </Tooltip>
      </Box>
    );
  },
);

ResponseButtons.displayName = "ResponseButtons";

export default ResponseButtons;

