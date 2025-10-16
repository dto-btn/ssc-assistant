import React from "react";
import { Box, Typography } from "@mui/material";

const StorageManager: React.FC = () => {
  return (
    <Box p={2} sx={{ width: "100%", maxWidth: 720, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>
        Storage Manager
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Playground uploads and file previews now rely on backend-managed routes. Please use the chat interface to attach and review files for each session.
      </Typography>
    </Box>
  );
};

export default StorageManager;
