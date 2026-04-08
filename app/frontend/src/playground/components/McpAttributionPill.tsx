import React from "react";
import {
  Box,
  Chip,
  Divider,
  Popover,
  Stack,
  Typography,
} from "@mui/material";
import { useTranslation } from "react-i18next";
import type { MessageMcpAttribution } from "../store/slices/chatSlice";

interface McpAttributionPillProps {
  attribution: MessageMcpAttribution;
  messageId: string;
}

const McpAttributionPill: React.FC<McpAttributionPillProps> = ({ attribution, messageId }) => {
  const { t } = useTranslation("playground");
  const [anchorEl, setAnchorEl] = React.useState<HTMLElement | null>(null);

  const open = Boolean(anchorEl);
  const popoverId = open ? `mcp-attribution-${messageId}` : undefined;
  const titleId = `${popoverId}-title`;

  const serverNames = attribution.servers.map((server) => server.serverLabel).filter(Boolean);
  const primaryServer = serverNames[0] || t("mcp.attribution.unknown");
  const additionalCount = Math.max(serverNames.length - 1, 0);
  const summaryLabel = t("mcp.attribution.summary", {
    primaryServer,
    suffix: additionalCount > 0 ? ` +${additionalCount}` : "",
  });

  const ariaLabel = t("mcp.attribution.trigger", {
    servers: serverNames.length > 0 ? serverNames.join(", ") : primaryServer,
  });

  const handleOpen = (event: React.MouseEvent<HTMLDivElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box sx={{ maxWidth: "100%" }}>
      <Chip
        clickable
        variant="outlined"
        color="default"
        label={summaryLabel}
        onClick={handleOpen}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open ? "true" : "false"}
        aria-controls={popoverId}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setAnchorEl(event.currentTarget);
          }
        }}
        sx={{
          borderRadius: 9999,
          maxWidth: "100%",
          display: "inline-flex",
          px: 1.25,
          py: 0.25,
          minHeight: 28,
          borderColor: "divider",
          color: "text.primary",
          backgroundColor: "background.default",
          overflow: "hidden",
          whiteSpace: "nowrap",
          textOverflow: "ellipsis",
          "&:focus-visible": {
            outline: 2,
            outlineColor: "primary.main",
            outlineOffset: 2,
          },
        }}
      />

      <Popover
        id={popoverId}
        open={open}
        anchorEl={anchorEl}
        onClose={handleClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "left" }}
        transformOrigin={{ vertical: "top", horizontal: "left" }}
        slotProps={{
          paper: {
            sx: {
              mt: 0.75,
              width: "min(26rem, calc(100vw - 2rem))",
              maxWidth: "calc(100vw - 2rem)",
              p: 1.5,
            },
            role: "dialog",
            "aria-labelledby": titleId,
          },
        }}
      >
        <Stack spacing={1}>
          <Typography id={titleId} variant="subtitle2">
            {t("mcp.attribution.title")}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t("mcp.attribution.description", { count: serverNames.length || 1 })}
          </Typography>
          <Divider />
          <Stack spacing={0.75}>
            {attribution.servers.map((server, index) => (
              <Typography
                key={`${server.serverLabel}-${index}`}
                variant="body2"
                sx={{ overflowWrap: "anywhere" }}
              >
                {server.serverLabel}
                {server.serverUrl ? ` (${server.serverUrl})` : ""}
              </Typography>
            ))}
          </Stack>
          {attribution.category ? (
            <Typography variant="caption" color="text.secondary">
              {t("mcp.attribution.category", { category: attribution.category })}
            </Typography>
          ) : null}
          {attribution.status ? (
            <Typography variant="caption" color="text.secondary">
              {t("mcp.attribution.status", { status: attribution.status })}
              {attribution.statusMessage ? ` - ${attribution.statusMessage}` : ""}
            </Typography>
          ) : null}
        </Stack>
      </Popover>
    </Box>
  );
};

export default McpAttributionPill;
