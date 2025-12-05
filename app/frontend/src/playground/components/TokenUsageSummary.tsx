import React from "react";
import { Box, Divider, Paper, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../store/hooks";
import { selectSessionTokenUsageSummary } from "../store/selectors/tokenSelectors";

const formatTokens = (value: number) => new Intl.NumberFormat().format(value);

export type TokenUsageSummaryVariant = "standalone" | "embedded";

interface TokenUsageSummaryProps {
  variant?: TokenUsageSummaryVariant;
}

interface MetricProps {
  label: string;
  value: number;
}

const Metric: React.FC<MetricProps> = ({ label, value }) => (
  <Box sx={{ display: "flex", flexDirection: "column" }}>
    <Typography variant="caption" sx={{ color: "rgba(248, 250, 252, 0.75)" }}>
      {label}
    </Typography>
    <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
      {formatTokens(value)}
    </Typography>
  </Box>
);

const TokenUsageSummary: React.FC<TokenUsageSummaryProps> = ({ variant = "standalone" }) => {
  const { t } = useTranslation("playground");
  const { totals, lastCall } = useAppSelector(selectSessionTokenUsageSummary);

  if (!totals.hasUsage) {
    return null;
  }

  const isEmbedded = variant === "embedded";

  return (
    <Paper
      elevation={0}
      sx={{
        margin: isEmbedded ? 0 : "8px 16px",
        padding: "14px 20px",
        display: "flex",
        alignItems: "stretch",
        gap: 3,
        borderRadius: isEmbedded ? "0 0 20px 20px" : "20px",
        background: "linear-gradient(135deg, #111b2f, #172844)",
        color: "#f8fafc",
        border: "1px solid rgba(148, 163, 184, 0.25)",
        borderTop: isEmbedded ? "1px solid rgba(148, 163, 184, 0.35)" : undefined,
      }}
    >
      <Box sx={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
          {t("token.usage.session.label")}
        </Typography>
        <Box sx={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          <Metric label={t("token.usage.prompt") as string} value={totals.promptTokens} />
          <Metric label={t("token.usage.completion") as string} value={totals.completionTokens} />
          <Metric label={t("token.usage.total") as string} value={totals.totalTokens} />
        </Box>
      </Box>

      <Divider orientation="vertical" flexItem sx={{ borderColor: "rgba(255,255,255,0.15)" }} />

      <Box sx={{ display: "flex", flexDirection: "column", gap: 1, minWidth: 0 }}>
        <Typography variant="caption" sx={{ textTransform: "uppercase", letterSpacing: 1 }}>
          {t("token.usage.last.label")}
        </Typography>
        {lastCall ? (
          <Box sx={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
            <Metric label={t("token.usage.prompt") as string} value={lastCall.promptTokens} />
            <Metric label={t("token.usage.completion") as string} value={lastCall.completionTokens} />
            <Metric label={t("token.usage.total") as string} value={lastCall.totalTokens} />
            <Box sx={{ display: "flex", flexDirection: "column" }}>
              <Typography variant="caption" sx={{ color: "rgba(248, 250, 252, 0.75)" }}>
                {t("token.usage.model")}
              </Typography>
              <Typography sx={{ fontWeight: 600 }}>
                {lastCall.model ?? t("token.usage.unknown")}
              </Typography>
            </Box>
          </Box>
        ) : (
          <Typography variant="body2" sx={{ color: "rgba(248, 250, 252, 0.8)" }}>
            {t("token.usage.none")}
          </Typography>
        )}
      </Box>
    </Paper>
  );
};

export default TokenUsageSummary;
