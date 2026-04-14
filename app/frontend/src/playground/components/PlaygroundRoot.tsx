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
import SessionBootstrapper from "./SessionBootstrapper";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import { loadServers } from "../store/slices/toolSlice";
import {
  closeMobileSidebar,
  openMobileSidebar,
  toggleSidebarCollapsed,
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
    <Box display="flex" height="100dvh">
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
      {isFeatureEnabled("FeedbackForm") && <FeedbackForm />}
    </Box>
  );
};

export default PlaygroundRoot;
