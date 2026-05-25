/**
 * Spend timeline section using analytics spend-timeline endpoint.
 * Shows daily request counts, tokens, and cost from LiteLLM_SpendLogs.
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../store/hooks";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const TimelineSection: React.FC = () => {
  const { t } = useTranslation("playground");
  const buckets = useAppSelector((s) => s.admin.spendTimeline);

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("admin.timeline.title")}
      </Typography>
      {buckets.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("admin.no_data")}
        </Typography>
      ) : (
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={buckets} margin={{ top: 5, right: 30, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="requests"
              name={t("admin.timeline.requests")}
              stroke="#1976d2"
              dot={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="tokens"
              name={t("admin.timeline.tokens")}
              stroke="#9c27b0"
              dot={false}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="avg_latency_ms"
              name={t("admin.timeline.avg_latency")}
              stroke="#e65100"
              dot={false}
              strokeDasharray="4 2"
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
};

export default TimelineSection;
