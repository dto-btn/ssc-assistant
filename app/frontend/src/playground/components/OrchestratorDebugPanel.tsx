import React from "react";
import { Box, Divider, List, ListItem, ListItemText, Typography } from "@mui/material";
import { useAppSelector } from "../store/hooks";

interface OrchestratorDebugPanelProps {
  sessionId: string;
}

const showOrchestratorDebug =
  import.meta.env.DEV && import.meta.env.VITE_PLAYGROUND_SHOW_ORCHESTRATOR_DEBUG === "true";

const formatPercent = (value?: number): string => {
  if (typeof value !== "number" || Number.isNaN(value)) return "n/a";
  const normalized = value <= 1 ? value * 100 : value;
  return `${Math.max(0, Math.min(100, normalized)).toFixed(0)}%`;
};

const formatClassificationMethod = (method?: string): string => {
  if (!method) return "unknown";
  const normalized = method.trim().toLowerCase();
  if (normalized === "ai") return "AI classified";
  if (normalized === "keyword") return "Keyword classified";
  if (normalized === "fallback") return "Fallback";
  return method;
};

const OrchestratorDebugPanel: React.FC<OrchestratorDebugPanelProps> = ({ sessionId }) => {
  const insights = useAppSelector(
    (state) => state.chat.orchestratorInsightsBySessionId?.[sessionId]
  );

  if (!showOrchestratorDebug || !insights) {
    return null;
  }

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
      <Typography variant="subtitle2">Orchestrator (Dev)</Typography>
      <Typography variant="body2" sx={{ mt: 0.5 }}>
        Category: <strong>{insights.category}</strong>
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        Source: {insights.source}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        Recommendations: {insights.recommendations.length}
      </Typography>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        Classification: {formatClassificationMethod(insights.classificationMethod)}
      </Typography>

      {insights.status ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          Status: {insights.status}
          {insights.statusMessage ? ` • ${insights.statusMessage}` : ""}
        </Typography>
      ) : null}

      {insights.transport ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          Transport: {insights.transport}
        </Typography>
      ) : null}

      {insights.fallbackReason ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          {insights.fallbackReason}
        </Typography>
      ) : null}

      {insights.fallbackUpstream === null ? (
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
          No upstream selected (fallback).
        </Typography>
      ) : null}

      {insights.selectedServers && insights.selectedServers.length > 0 ? (
        <Box sx={{ mt: 0.5, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Selected MCP servers used for this turn:
          </Typography>
          {insights.selectedServers.map((server, index) => (
            <Typography
              key={`${server.server_url}-${index}`}
              variant="caption"
              color="text.secondary"
              sx={{ display: "block" }}
            >
              {server.server_label} • {server.server_url}
            </Typography>
          ))}
        </Box>
      ) : null}

      {insights.progressUpdates && insights.progressUpdates.length > 0 ? (
        <Box sx={{ mt: 0.5, mb: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: "block" }}>
            Orchestrator updates:
          </Typography>
          {insights.progressUpdates.slice(-6).map((update, index) => (
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
      ) : null}

      {insights.recommendations.length > 0 ? (
        <List dense disablePadding>
          {insights.recommendations.slice(0, 3).map((recommendation, index) => (
            <React.Fragment key={`${recommendation.mcp_server_id}-${index}`}>
              <ListItem disableGutters>
                <ListItemText
                  primary={recommendation.mcp_server_id}
                  secondary={`Confidence: ${formatPercent(recommendation.confidence)}${recommendation.endpoint ? ` • ${recommendation.endpoint}` : ""}`}
                />
              </ListItem>
              {index < insights.recommendations.length - 1 ? <Divider component="li" /> : null}
            </React.Fragment>
          ))}
        </List>
      ) : (
        <Typography variant="caption" color="text.secondary">
          No MCP route recommendations.
        </Typography>
      )}
    </Box>
  );
};

export default OrchestratorDebugPanel;
