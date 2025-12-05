import React from "react";
import { Box, Collapse, IconButton, Paper, Typography, Tooltip } from "@mui/material";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import BarChartRoundedIcon from "@mui/icons-material/BarChartRounded";
import { useTranslation } from "react-i18next";
import TokenUsageSummary from "./TokenUsageSummary";
import { useAppSelector } from "../store/hooks";
import { selectSessionTokenUsageSummary } from "../store/selectors/tokenSelectors";

const STORAGE_KEY = "playground_token_usage_drawer_open";

const formatTokens = (value: number) => new Intl.NumberFormat().format(value);

const TokenUsageDrawer: React.FC = () => {
  const { t } = useTranslation("playground");
  const { totals } = useAppSelector(selectSessionTokenUsageSummary);
  const [isOpen, setIsOpen] = React.useState<boolean>(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  });

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    window.localStorage.setItem(STORAGE_KEY, String(isOpen));
  }, [isOpen]);

  if (!totals.hasUsage) {
    return null;
  }

  const handleToggle = () => setIsOpen((prev) => !prev);

  if (!isOpen) {
    return (
      <Box sx={{ px: 2, pb: 1, display: "flex", justifyContent: "flex-end" }}>
        <Tooltip title={t("token.drawer.expand") as string} placement="top">
          <IconButton
            color="primary"
            size="small"
            onClick={handleToggle}
            aria-label={t("token.drawer.expand") as string}
            sx={{
              border: "1px solid rgba(148, 163, 184, 0.5)",
              backgroundColor: "rgba(15, 23, 42, 0.85)",
              color: "#e2e8f0",
              borderRadius: "50%",
              width: 40,
              height: 40,
            }}
          >
            <BarChartRoundedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
    );
  }

  return (
    <Box sx={{ px: 2, pb: 1 }}>
      <Paper
        elevation={0}
        sx={{
          borderRadius: "18px",
          border: "1px solid rgba(148, 163, 184, 0.35)",
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          color: "#e2e8f0",
          overflow: "hidden",
        }}
      >
        <Box
          role="button"
          tabIndex={0}
          aria-expanded={isOpen}
          aria-label={t("token.drawer.collapse")}
          onClick={handleToggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              handleToggle();
            }
          }}
          sx={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            px: 2,
            py: 1.25,
            minHeight: 48,
          }}
        >
          <Box sx={{ display: "flex", flexDirection: "column" }}>
            <Typography variant="caption" sx={{ letterSpacing: 0.5, textTransform: "uppercase" }}>
              {t("token.drawer.label")}
            </Typography>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatTokens(totals.totalTokens)} {t("token.usage.total")}
            </Typography>
          </Box>
          <IconButton
            size="small"
            aria-hidden="true"
            tabIndex={-1}
            sx={{ color: "inherit" }}
          >
            <ExpandLessIcon fontSize="small" />
          </IconButton>
        </Box>
        <Collapse in={isOpen} timeout="auto" unmountOnExit>
          <TokenUsageSummary variant="embedded" />
        </Collapse>
      </Paper>
    </Box>
  );
};

export default TokenUsageDrawer;
