import React from "react";
import { Box, Chip, CircularProgress, Tooltip } from "@mui/material";
import CloudDoneIcon from "@mui/icons-material/CloudDone";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import CloudSyncIcon from "@mui/icons-material/CloudSync";
import ErrorOutlineIcon from "@mui/icons-material/ErrorOutline";
import type { SxProps, Theme } from "@mui/material/styles";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";
import type { SessionSyncStatus } from "../store/slices/syncSlice";
import { selectSyncEntryBySession } from "../store/selectors/syncSelectors";

interface SyncStatusIndicatorProps {
  sessionId: string;
  variant?: "chip" | "icon";
  sx?: SxProps<Theme>;
}

type StatusConfig = {
  label: string;
  tooltip?: string;
  icon: React.ReactElement;
  color: "default" | "primary" | "secondary" | "error" | "info" | "success" | "warning";
  chipVariant: "filled" | "outlined";
};

function buildStatusConfig(status: SessionSyncStatus, label: string, tooltip?: string): StatusConfig {
  switch (status) {
    case "pending":
      return {
        label,
        tooltip,
        icon: <CloudUploadIcon fontSize="small" />, 
        color: "warning",
        chipVariant: "filled",
      };
    case "syncing":
      return {
        label,
        tooltip,
        icon: <CloudSyncIcon fontSize="small" />, 
        color: "info",
        chipVariant: "filled",
      };
    case "error":
      return {
        label,
        tooltip,
        icon: <ErrorOutlineIcon fontSize="small" />, 
        color: "error",
        chipVariant: "filled",
      };
    case "synced":
    default:
      return {
        label,
        tooltip,
        icon: <CloudDoneIcon fontSize="small" />, 
        color: "success",
        chipVariant: "outlined",
      };
  }
}

export const SyncStatusIndicator: React.FC<SyncStatusIndicatorProps> = ({ sessionId, variant = "chip", sx }) => {
  const { t } = useTranslation("playground");
  const syncEntry = useAppSelector((state) => selectSyncEntryBySession(state, sessionId));
  const status: SessionSyncStatus = syncEntry?.status ?? "synced";
  const baseLabelKey = `sync.status.${status}`;
  const label = t(baseLabelKey as never);
  const tooltip = status === "error" && syncEntry?.error ? syncEntry.error : label;
  const config = buildStatusConfig(status, label, tooltip);

  if (variant === "icon") {
    const inlineIcon: React.ReactElement = status === "syncing"
      ? <CircularProgress size={14} thickness={5} color="inherit" />
      : config.icon;

    return (
      <Tooltip title={config.tooltip || label} placement="top">
        <Box component="span" sx={{ color: `${config.color}.main`, display: "inline-flex", alignItems: "center", ...sx }}>
          {inlineIcon}
        </Box>
      </Tooltip>
    );
  }

  const chipIconElement: React.ReactElement = status === "syncing"
    ? <CircularProgress size={12} thickness={5} color="inherit" />
    : config.icon;

  return (
    <Box sx={{ display: "inline-flex", ...sx }}>
      <Tooltip title={config.tooltip || label} placement="left">
        <Chip
          size="small"
          icon={chipIconElement}
          label={label}
          color={config.color}
          variant={config.chipVariant}
          sx={{ fontWeight: 500 }}
        />
      </Tooltip>
    </Box>
  );
};

export default SyncStatusIndicator;
