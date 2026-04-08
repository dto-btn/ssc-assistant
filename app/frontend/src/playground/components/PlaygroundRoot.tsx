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
import FeedbackForm from "./FeedbackForm";
import { useAuth } from "../store/hooks/useAuth";
import { apiUse } from "../../authConfig";
import isFeatureEnabled from "../FeatureGate";
import { DevBanner } from "./DevBanner";
import SessionBootstrapper from "./SessionBootstrapper";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { loadServers } from "../store/slices/toolSlice";
import {
  closeMobileSidebar,
  openMobileSidebar,
  setSidebarCollapsed,
} from "../store/slices/uiSlice";

/**
 * Top-level layout controller for playground sidebar behavior across breakpoints.
 */
const PlaygroundRoot: React.FC = () => {
  // Initialize authentication and get token on app load
  useAuth(apiUse);

  const dispatch = useAppDispatch();
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
    <>
      <SessionBootstrapper />
      <Box display="flex" height="100vh">
        <SessionSidebar isMobile={isMobile} />
        <ChatArea
          showSidebarToggle={isMobile || isSidebarCollapsed}
          isSidebarOpen={isMobile ? isMobileSidebarOpen : !isSidebarCollapsed}
          onOpenSidebar={() =>
            // On desktop, the same control re-expands a fully hidden sidebar.
            dispatch(isMobile ? openMobileSidebar() : setSidebarCollapsed(false))
          }
        />
      </Box>
      {isFeatureEnabled("FeedbackForm") && <FeedbackForm />}
      <DevBanner />
    </>
  );
};

export default PlaygroundRoot;
