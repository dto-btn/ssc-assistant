/**
 * ToolCallsDisplay component
 *
 * Renders a visual summary of MCP tool calls made during an assistant response.
 * Shows each tool name, its server label (if available), and a status indicator.
 */
import React from "react";
import { Box, Chip, Tooltip, Typography, CircularProgress } from "@mui/material";
import HandymanIcon from "@mui/icons-material/Handyman";
import CheckCircleOutlineIcon from "@mui/icons-material/CheckCircleOutline";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import { useTranslation } from "react-i18next";
import { ToolCallInfo } from "../store/slices/chatSlice";

interface ToolCallsDisplayProps {
  toolCalls: ToolCallInfo[];
}

const ToolCallsDisplay: React.FC<ToolCallsDisplayProps> = ({ toolCalls }) => {
  const { t } = useTranslation("playground");

  if (!toolCalls || toolCalls.length === 0) return null;

  const getStatusIcon = (status: ToolCallInfo["status"]) => {
    if (status === "in_progress") {
      return <CircularProgress size={12} sx={{ color: "inherit" }} />;
    }
    if (status === "completed") {
      return <CheckCircleOutlineIcon style={{ fontSize: 14, color: "#2e7d32" }} />;
    }
    return <ErrorOutlineIcon style={{ fontSize: 14, color: "#c62828" }} />;
  };

  const getStatusColor = (
    status: ToolCallInfo["status"]
  ): "default" | "primary" | "success" | "error" => {
    if (status === "in_progress") return "primary";
    if (status === "completed") return "success";
    return "error";
  };

  return (
    <Box
      sx={{
        mt: 1,
        mb: 1,
        p: 1,
        borderRadius: 1,
        backgroundColor: "rgba(0, 0, 0, 0.03)",
        border: "1px solid rgba(0,0,0,0.08)",
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mb: 0.5 }}>
        {t("tool.calls.used")}
      </Typography>
      <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.75 }}>
        {toolCalls.map((toolCall, index) => {
          const tooltipTitle = toolCall.serverLabel
            ? `${toolCall.name} (${toolCall.serverLabel})`
            : toolCall.name;
          return (
            <Tooltip key={index} title={tooltipTitle} arrow>
              <Chip
                icon={
                  <HandymanIcon
                    style={{
                      fontSize: 14,
                      color: "#4b3e99",
                    }}
                  />
                }
                label={
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    <span>{toolCall.name}</span>
                    {getStatusIcon(toolCall.status)}
                  </Box>
                }
                size="small"
                color={getStatusColor(toolCall.status)}
                variant="outlined"
                sx={{ height: "auto", py: 0.25 }}
              />
            </Tooltip>
          );
        })}
      </Box>
    </Box>
  );
};

export default ToolCallsDisplay;
