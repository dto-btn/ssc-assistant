/**
 * PlaygroundRoot component
 *
 * Root component for the playground UI. Wires together the sidebar, chat
 * area and global context providers (e.g., store persistence).
 */

import React, { useEffect } from "react";
import { Box } from "@mui/material";
import SessionSidebar from "./SessionSidebar";
import ChatArea from "./ChatArea";
import FeedbackForm from "./FeedbackForm";
import { useAuth } from "../store/hooks/useAuth";
import { apiUse } from "../../authConfig";
import isFeatureEnabled from "../FeatureGate";
import MCPClient from "../MCPClient";

const PlaygroundRoot: React.FC = () => {
  // Initialize authentication and get token on app load
  useAuth(apiUse);

  useEffect(() => {
    // Initialize MCPClient and log available tools
    const client = new MCPClient();
    client.listTools().then(tools => {
      console.log('Available tools:', tools);
    }).catch(err => {
      console.error('Error listing tools:', err);
    });
    client.listPrompts().then(prompts => {
      console.log('Available prompts:', prompts);
    }).catch(err => {
      console.error('Error listing prompts:', err);
    });
    client.listResources().then(resources => {
      console.log('Available resources:', resources);
    }).catch(err => {
      console.error('Error listing resources:', err);
    });
    client.readResource('greeting://jay').then(resource => {
      console.log('Read resource:', resource);
    }).catch(err => {
      console.error('Error reading resource:', err);
    });
    client.getPrompt("greet_user", { name: "Jay" }).then(prompt => {
      console.log('Get prompt:', prompt);
    }).catch(err => {
      console.error('Error getting prompt:', err);
    });
    client.callTool("list_all_mps", {}).then(response => {
      console.log('List all MPs response:', response);
    }).catch(err => {
      console.error('Error calling list_all_mps tool:', err);
    });

  }, []);

  return (
    <>
      <Box display="flex" height="100vh">
        <SessionSidebar />
        <ChatArea />
      </Box>
      {isFeatureEnabled("FeedbackForm") && <FeedbackForm />}
    </>
  );
};

export default PlaygroundRoot;
