import React from "react";
import { Box, Typography } from "@mui/material";
import { useAppSelector } from "../store/hooks";

interface AgentActivityPanelProps {
  sessionId: string;
}

const titleForStatus = (status?: string): string => {
  if (!status) return "Waiting for orchestrator";
  if (status === "connecting") return "Connecting";
  if (status === "connected") return "Connected";
  if (status === "classifying") return "Classifying";
  if (status === "routing") return "Routing";
  if (status === "done") return "Ready";
  if (status === "error") return "Issue";
  return status;
};

const AgentActivityPanel: React.FC<AgentActivityPanelProps> = ({ sessionId }) => {
  const insights = useAppSelector(
    (state) => state.chat.orchestratorInsightsBySessionId?.[sessionId]
  );

  if (!insights) {
    return null;
  }

  const updates = insights.progressUpdates ?? [];
  const latestUpdates = updates.slice(-3);
  const derivedStatus = insights.status || updates[updates.length - 1]?.status ||
    (insights.category && insights.category !== "routing" ? "done" : undefined);

  return (
    <Box
      sx={{
        mx: 2,
        mb: 1,
        px: 1.5,
        py: 1,
        borderRadius: 1,
        border: 1,
        borderColor: "divider",
        bgcolor: "background.paper",
      }}
    >
      <Typography variant="subtitle2">Live Agent Status</Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {titleForStatus(derivedStatus)}
        {insights.statusMessage ? ` • ${insights.statusMessage}` : ""}
      </Typography>

      {latestUpdates.map((update, index) => (
        <Typography
          key={`${update.timestamp}-${index}`}
          variant="caption"
          color="text.secondary"
          sx={{ display: "block" }}
        >
          {new Date(update.timestamp).toLocaleTimeString()} • {update.status} • {update.message}
        </Typography>
      ))}
    </Box>
  );
};

export default AgentActivityPanel;
