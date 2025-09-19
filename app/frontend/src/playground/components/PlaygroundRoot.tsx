import React from "react";
import { Box } from "@mui/material";
import SessionSidebar from "./SessionSidebar";
import ChatArea from "./ChatArea";
import FeedbackForm from "./FeedbackForm";

const PlaygroundRoot: React.FC = () => {
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