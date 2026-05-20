/**
 * PlaygroundRoot component
 *
 * Root component for the playground UI. Wires together the sidebar, chat
 * area and global context providers (e.g., store persistence).
 */

import React from "react";
import { Box, useMediaQuery, useTheme } from "@mui/material";
import SessionSidebar from "./SessionSidebar";
import ChatArea from "./ChatArea";
import { useAuth } from "../store/hooks/useAuth";
import { apiUse } from "../../authConfig";
import SessionBootstrapper from "./SessionBootstrapper";
import PlaygroundDisclaimerDialog from "./PlaygroundDisclaimerDialog";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { loadServers } from "../store/slices/toolSlice";
import {
  closeMobileSidebar,
  openMobileSidebar,
  toggleSidebarCollapsed,
} from "../store/slices/uiSlice";
import { useTranslation } from "react-i18next";

/**
 * Top-level layout controller for playground sidebar behavior across breakpoints.
 */
export const PlaygroundShell: React.FC = () => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation("playground");
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileSidebarOpen = useAppSelector(
    (state) => state.ui.isMobileSidebarOpen
  );
  const isSidebarCollapsed = useAppSelector(
    (state) => state.ui.isSidebarCollapsed
  );

  // Load MCP server configuration on startup
  React.useEffect(() => {
    dispatch(loadServers());
  }, [dispatch]);

  React.useEffect(() => {
    // Prevent a stale mobile drawer state from leaking into desktop layout.
    if (!isMobile && isMobileSidebarOpen) {
      dispatch(closeMobileSidebar());
    }
  }, [dispatch, isMobile, isMobileSidebarOpen]);

  return (
    <Box display="flex" height="100dvh">
      <Box
        component="a"
        href="#playground-ask-question"
        onClick={(e: React.MouseEvent<HTMLAnchorElement>) => {
          const input = document.getElementById("playground-ask-question");
          if (input) {
            e.preventDefault();
            input.focus();
          } else {
            // Input not yet rendered (no active session) — focus New Chat button instead
            e.preventDefault();
            const newChatBtn = document.getElementById("new-chat-button");
            newChatBtn?.focus();
          }
        }}
        sx={{
          position: "absolute",
          left: "-9999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          "&:focus": {
            position: "fixed",
            top: 0,
            left: 0,
            width: "auto",
            height: "auto",
            overflow: "visible",
            zIndex: 9999,
            padding: "8px 16px",
            bgcolor: "primary.main",
            color: "primary.contrastText",
            fontWeight: "bold",
            borderRadius: "0 0 4px 0",
          },
        }}
      >
        {t("skip.to.chat", { defaultValue: "Skip to chat" })}
      </Box>
      <SessionBootstrapper />
      <SessionSidebar isMobile={isMobile} />
      <ChatArea
        isSidebarOpen={isMobile ? isMobileSidebarOpen : !isSidebarCollapsed}
        onOpenSidebar={() => {
          if (isMobile) {
            dispatch(isMobileSidebarOpen ? closeMobileSidebar() : openMobileSidebar());
          } else {
            dispatch(toggleSidebarCollapsed());
          }
        }}
      />
      <PlaygroundDisclaimerDialog />
    </Box>
  );
};

const PlaygroundRoot: React.FC = () => {
  // Initialize authentication and get token on app load.
  useAuth(apiUse);

  return <PlaygroundShell />;
};

export default PlaygroundRoot;
