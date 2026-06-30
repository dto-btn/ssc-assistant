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
import NewConversationOnOpen from "./NewConversationOnOpen";
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
  const { t, i18n } = useTranslation("playground");

  // WCAG 3.1.1 / 3.1.2 — keep the HTML lang attribute in sync with the active language
  // so screen readers use the correct pronunciation rules after a language toggle.
  React.useEffect(() => {
    document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  // WCAG 2.4.2 — keep the document title descriptive and bilingual so the page is
  // identifiable in browser tabs/history and updates when the language is toggled.
  React.useEffect(() => {
    document.title = t("page.title");
  }, [t, i18n.language]);
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
      {/* WCAG 2.4.1 — skip link lets keyboard users bypass sidebar navigation */}
      <Box
        component="a"
        href="#playground-main-content"
        sx={{
          position: "absolute",
          left: "-999px",
          top: "auto",
          width: "1px",
          height: "1px",
          overflow: "hidden",
          zIndex: 10000,
          "&:focus, &:active": {
            left: "8px",
            top: "8px",
            width: "auto",
            height: "auto",
            padding: "8px 12px",
            backgroundColor: "#ffffff",
            color: "#000000",
            border: "2px solid #000000",
            borderRadius: "4px",
            textDecoration: "none",
            fontSize: "1rem",
          },
        }}
      >
        {t("skip.to.main")}
      </Box>
      <SessionBootstrapper />
      <NewConversationOnOpen />
      <SessionSidebar isMobile={isMobile} />
      {/* Skip-link target — ChatArea renders its own <main> landmark internally;
          this div only needs tabIndex={-1} so the skip link can shift focus here
          without adding a second <main> to the page. */}
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
