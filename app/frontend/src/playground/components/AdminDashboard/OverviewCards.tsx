/**
 * Overview metric cards for the admin dashboard.
 */

import React from "react";
import { Box, Card, CardContent, Typography, Skeleton } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../store/hooks";

interface MetricCardProps {
  label: string;
  value: string | number;
  loading: boolean;
}

const MetricCard: React.FC<MetricCardProps> = ({ label, value, loading }) => (
  <Card variant="outlined" sx={{ minWidth: 150, flex: "1 1 150px" }}>
    <CardContent>
      <Typography variant="caption" color="text.secondary" display="block">
        {label}
      </Typography>
      {loading ? (
        <Skeleton width="60%" />
      ) : (
        <Typography variant="h6" fontWeight="bold">
          {value}
        </Typography>
      )}
    </CardContent>
  </Card>
);

const OverviewCards: React.FC = () => {
  const { t } = useTranslation("playground");
  const overview = useAppSelector((s) => s.admin.overview);
  const isLoading = useAppSelector((s) => s.admin.isLoading);

  return (
    <Box display="flex" gap={2} flexWrap="wrap">
      <MetricCard
        label={t("admin.overview.total_requests")}
        value={overview?.total_requests ?? "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.total_tokens")}
        value={overview?.total_tokens?.toLocaleString() ?? "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.total_cost")}
        value={overview ? `$${overview.total_cost.toFixed(4)}` : "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.avg_latency")}
        value={overview ? `${overview.avg_latency_ms} ms` : "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.p50_latency")}
        value={overview ? `${overview.p50_latency_ms} ms` : "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.p95_latency")}
        value={overview ? `${overview.p95_latency_ms} ms` : "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.p99_latency")}
        value={overview ? `${overview.p99_latency_ms} ms` : "—"}
        loading={isLoading && !overview}
      />
      <MetricCard
        label={t("admin.overview.error_rate")}
        value={overview ? `${overview.error_rate}%` : "—"}
        loading={isLoading && !overview}
      />
    </Box>
  );
};

export default OverviewCards;
