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
import { apiUse } from "../../authConfig";

const PlaygroundRoot: React.FC = () => {
  // Initialize authentication and get token on app load
  const { isAuthenticated, isTokenRefreshing } = useAuth(apiUse);

  console.log("Playground Auth Status:", {
    isAuthenticated,
    isTokenRefreshing,
  });

  return (
    <>
      <Box display="flex" height="100vh">
        <SessionSidebar />
        <ChatArea />
      </Box>
      <FeedbackForm />
    </>
  );
};

export default PlaygroundRoot;
