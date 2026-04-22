/**
 * ResponseButtons component
 *
 * Renders copy, regenerate, like, and dislike action buttons beneath an
 * assistant message in the playground. Designed to be WCAG 2.1 AA compliant
 * and responsive across all screen sizes.
 *
 * - Copy: writes the message text to the clipboard and shows a brief
 *   confirmation icon for 3 seconds.
 * - Regenerate: deletes the stale assistant message and re-sends via
 *   `sendAssistantMessage`. The user message is kept visible (`skipUserMessage: true`
 *   prevents a duplicate). Synchronous dispatches are batched by React 18 so
 *   the UI transitions directly to the loading state with no intermediate flash.
 * - Like / Dislike: immediately submits feedback via `submitResponseFeedback`
 *   (no modal). The pressed button stays visually active; clicking the same
 *   button again deselects it. Like and dislike are mutually exclusive in the
 *   UI; the server records all submitted feedback events.
 *
 * On desktop the buttons are shown when the parent message is hovered or
 * focused. On small/touch-screen devices (`isSmallScreen`) they are always
 * visible because hover events are unreliable on touchscreens.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { alpha } from "@mui/material/styles";
import { Tooltip, Box, IconButton, useTheme, useMediaQuery } from "@mui/material";
import ThumbUpAltOutlinedIcon from "@mui/icons-material/ThumbUpAltOutlined";
import ThumbDownAltOutlinedIcon from "@mui/icons-material/ThumbDownAltOutlined";
import ThumbUpAltIcon from "@mui/icons-material/ThumbUpAlt";
import ThumbDownAltIcon from "@mui/icons-material/ThumbDownAlt";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import CheckIcon from "@mui/icons-material/Check";
import RefreshIcon from "@mui/icons-material/Refresh";
import { useTranslation } from "react-i18next";
import type { AppDispatch } from "../store";
import { Message } from "../store/slices/chatSlice";
import { submitResponseFeedback, clearResponseFeedback } from "../store/thunks/feedbackThunks";
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
  /**
   * The session-scoped message list, passed down from ChatMessages.
   * Avoids re-selecting by currentSessionId from the store, which can diverge
   * from the sessionId prop when multiple sessions are in flight.
   */
  messages: Message[];
  /** The session this message belongs to, forwarded to sendAssistantMessage on regenerate. */
  sessionId: string;
  /** The feedback state for this message, retrieved from the Redux store. */
  feedback?: "liked" | "disliked";
}

const COPY_RESET_MS = 3000;

/** Visually-hidden style — removes an element from view while keeping it accessible to screen readers. */
const visuallyHiddenSx = {
  position: "absolute",
  width: "1px",
  height: "1px",
  overflow: "hidden",
  clip: "rect(0,0,0,0)",
  whiteSpace: "nowrap",
} as const;

const ResponseButtons: React.FC<ResponseButtonsProps> = React.memo(
  ({ isHovering, isMostRecent, text, messageId, isStreaming, messages, sessionId, feedback }) => {
    const { t } = useTranslation("playground");
    const dispatch = useDispatch<AppDispatch>();
    const theme = useTheme();
    // (pointer: coarse) matches any touch-first device regardless of resolution —
    // more reliable than a breakpoint which misses large tablets (e.g. iPad Pro landscape).
    const isSmallScreen = useMediaQuery("(pointer: coarse)");

    // Source brand colour from the theme so a single-point change propagates everywhere
    const brandColor = theme.palette.primary.main;

    /** sx applied to every IconButton — ensures a 44×44 touch target (WCAG 2.5.5) */
    const baseIconButtonSx = useMemo(() => ({
      borderRadius: "6px",
      padding: "10px",
      minWidth: 44,
      minHeight: 44,
      "&:hover": { backgroundColor: alpha(brandColor, 0.08) },
      // Visible focus ring for keyboard navigation (WCAG 2.4.7)
      "&.Mui-focusVisible": {
        outline: `2px solid ${brandColor}`,
        outlineOffset: "2px",
        backgroundColor: alpha(brandColor, 0.08),
      },
    }), [brandColor]);

    /** Additional sx for an actively-pressed like/dislike button */
    const activeFeedbackSx = useMemo(() => ({
      ...baseIconButtonSx,
      backgroundColor: alpha(brandColor, 0.12),
      "&:hover": { backgroundColor: alpha(brandColor, 0.18) },
    }), [baseIconButtonSx, brandColor]);

    const [isCopied, setIsCopied] = useState(false);
    const [isFocused, setIsFocused] = useState(false);

    // Guards against a double-dispatch on rapid taps: once regenerate fires we
    // block re-entry until the component unmounts (which happens after deleteMessage).
    const isRegeneratingRef = useRef(false);

    // Buttons are visible when the row is hovered/focused, it is the most
    // recent response, or we are on a small/touch-screen device.
    const isVisible = isHovering || isMostRecent || isSmallScreen || isFocused;
    const iconColor = isVisible ? brandColor : "transparent";

    useEffect(() => {
      if (!isCopied) return undefined;
      const timer = setTimeout(() => setIsCopied(false), COPY_RESET_MS);
      return () => clearTimeout(timer);
    }, [isCopied]);

    const handleCopy = useCallback(() => {
      navigator.clipboard.writeText(text)
        .then(() => setIsCopied(true))
        .catch(() => {
          // Clipboard access denied or unavailable (e.g. insecure context)
        });
    }, [text]);

    const handleFocus = useCallback(() => setIsFocused(true), []);
    // Only hide buttons when focus leaves the entire group, not when tabbing between buttons
    const handleBlur = useCallback((e: React.FocusEvent<HTMLDivElement>) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
        setIsFocused(false);
      }
    }, []);

    /**
     * Deletes the stale assistant message and re-sends via `sendAssistantMessage`.
     * The user message is kept visible — `skipUserMessage: true` prevents a
     * duplicate user turn. Synchronous dispatches are batched by React 18 so
     * the UI transitions directly to the loading state with no intermediate flash.
     *
     * `isRegeneratingRef` blocks re-entry on rapid double-taps: the render cycle
     * gap between the first click and `isStreaming` becoming `true` is enough for
     * a second tap to fire the handler again without the guard.
     */
    const handleRegenerate = useCallback(() => {
      if (isRegeneratingRef.current) return;

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

      // All validation passed — lock before dispatching so only one regenerate
      // can fire per component lifetime (ref resets naturally on unmount).
      isRegeneratingRef.current = true;

      void dispatch(
        sendAssistantMessage({
          sessionId,
          content: userMessage.content,
          attachments: userMessage.attachments,
          skipUserMessage: true,
          deleteMessageId: messageId,
        }),
      );
    }, [dispatch, messageId, messages, sessionId]);

    // Like and dislike are mutually exclusive in the UI. When switching from one
    // to the other, the new feedback is submitted; the server records both events.
    const handleLike = useCallback(() => {
      if (feedback === "liked") {
        dispatch(clearResponseFeedback(messageId));
      } else {
        dispatch(submitResponseFeedback(messageId, true));
      }
    }, [dispatch, feedback, messageId]);

    const handleDislike = useCallback(() => {
      if (feedback === "disliked") {
        dispatch(clearResponseFeedback(messageId));
      } else {
        dispatch(submitResponseFeedback(messageId, false));
      }
    }, [dispatch, feedback, messageId]);

    const isLiked = feedback === "liked";
    const isDisliked = feedback === "disliked";

    return (
      // role="group" gives screen-reader users context that these buttons belong together (WCAG 1.3.1)
      <Box
        role="group"
        aria-label={t("message.actions")}
        // Hide the entire group from AT when buttons are invisible — prevents screen readers
        // from announcing "Message actions" and finding no accessible children (WCAG 1.3.1)
        aria-hidden={!isVisible}
        onFocus={handleFocus}
        onBlur={handleBlur}
        sx={{
          display: isVisible ? "inline-flex" : "none",
          alignItems: "center",
          mt: 0.5,
          // Prevent ghost hover highlights on invisible buttons (WCAG 2.1.1)
          pointerEvents: isVisible ? "auto" : "none",
        }}
      >
        {/*
          Visually-hidden live region — announces only copy confirmations to screen
          readers without interrupting ongoing speech (WCAG 4.1.3). Scoping it here
          (rather than on the outer Box) prevents unrelated state changes from
          triggering announcements.
        */}
        <Box component="span" aria-live="polite" aria-atomic="true" sx={visuallyHiddenSx}>
          {isCopied ? t("copy.success") : ""}
        </Box>

        <Tooltip title={isCopied ? t("copy.success") : t("copy")} arrow>
          <IconButton
            aria-label={isCopied ? t("copy.success") : t("copy")}
            size="small"
            onClick={handleCopy}
            tabIndex={isVisible ? 0 : -1}
            aria-hidden={!isVisible}
            sx={baseIconButtonSx}
          >
            {isCopied ? (
              <CheckIcon sx={{ fontSize: 20, color: brandColor }} />
            ) : (
              <ContentCopyIcon sx={{ fontSize: 20, color: iconColor }} />
            )}
          </IconButton>
        </Tooltip>

        {/* Regenerate — only on the most recent non-streaming response */}
        {isMostRecent && !isStreaming && (
          <Tooltip title={t("regenerate")} arrow>
            <IconButton
              aria-label={t("regenerate")}
              size="small"
              onClick={handleRegenerate}
              tabIndex={isVisible ? 0 : -1}
              aria-hidden={!isVisible}
              sx={baseIconButtonSx}
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
            tabIndex={isVisible ? 0 : -1}
            aria-hidden={!isVisible}
            sx={isLiked ? activeFeedbackSx : baseIconButtonSx}
          >
            {isLiked ? (
              <ThumbUpAltIcon sx={{ fontSize: 20, color: brandColor }} />
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
            tabIndex={isVisible ? 0 : -1}
            aria-hidden={!isVisible}
            sx={isDisliked ? activeFeedbackSx : baseIconButtonSx}
          >
            {isDisliked ? (
              <ThumbDownAltIcon sx={{ fontSize: 20, color: brandColor }} />
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

