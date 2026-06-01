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
  const { i18n } = useTranslation("playground");

  // WCAG 3.1.1 / 3.1.2 — keep the HTML lang attribute in sync with the active language
  // so screen readers use the correct pronunciation rules after a language toggle.
  React.useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);
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
      <SessionBootstrapper />
      <SessionSidebar isMobile={isMobile} />
      <Box
        id="playground-main-content"
        tabIndex={-1}
        sx={{ flex: 1, display: "flex", minWidth: 0 }}
      >
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
      </Box>
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
