/**
 * PlaygroundRoot component
 *
 * Root component for the playground UI. Wires together the sidebar, chat
 * area and global context providers (e.g., store persistence).
 */

import React from "react";
import { Box } from "@mui/material";
import SessionSidebar from "./SessionSidebar";
import ChatArea from "./ChatArea";
import FeedbackForm from "./FeedbackForm";
import { useAuth } from "../store/hooks/useAuth";
import { useKeycloakAuth } from "../store/hooks/useKeycloakAuth";
import { apiUse } from "../../authConfig";
import isFeatureEnabled from "../FeatureGate";
import { DevBanner } from "./DevBanner";
import SessionBootstrapper from "./SessionBootstrapper";
import { useAppDispatch } from "../store/hooks";
import { loadServers } from "../store/slices/toolSlice";

const authProvider = (import.meta.env.VITE_AUTH_PROVIDER as string) || "msal";

const MsalAuthBootstrap: React.FC = () => {
  useAuth(apiUse);
  return null;
};

const KeycloakAuthBootstrap: React.FC = () => {
  useKeycloakAuth();
  return null;
};

const AuthBootstrap = authProvider === "keycloak" ? KeycloakAuthBootstrap : MsalAuthBootstrap;

const PlaygroundRoot: React.FC = () => {
  const dispatch = useAppDispatch();

  // Load MCP server configuration on startup
  React.useEffect(() => {
    dispatch(loadServers());
  }, [dispatch]);

  return (
    <>
      <AuthBootstrap />
      <SessionBootstrapper />
      <Box display="flex" height="100vh">
        <SessionSidebar />
        <ChatArea />
      </Box>
      {isFeatureEnabled("FeedbackForm") && <FeedbackForm />}
      <DevBanner />
    </>
  );
};

export default PlaygroundRoot;
