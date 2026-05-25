/**
 * User statistics section for the admin dashboard.
 *
 * Displays per-user and per-session aggregate metrics derived from
 * proxy_analytics_events rows that carry an x-user-id / x-session-id header.
 */

import React from "react";
import { Box, Card, CardContent, Typography, Skeleton, Alert } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../store/hooks";

interface StatCardProps {
  label: string;
  value: string | number;
  loading: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ label, value, loading }) => (
  <Card variant="outlined" sx={{ minWidth: 160, flex: "1 1 160px" }}>
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

const UserStatsSection: React.FC = () => {
  const { t } = useTranslation("playground");
  const userStats = useAppSelector((s) => s.admin.userStats);
  const isLoading = useAppSelector((s) => s.admin.isLoading);

  const loading = isLoading && !userStats;

  if (!loading && userStats && userStats.unique_users === 0) {
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {t("admin.user_stats.title")}
        </Typography>
        <Alert severity="info">
          {t("admin.user_stats.no_data")}
        </Alert>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("admin.user_stats.title")}
      </Typography>
      <Box display="flex" gap={2} flexWrap="wrap">
        <StatCard
          label={t("admin.user_stats.unique_users")}
          value={userStats?.unique_users ?? "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.total_questions")}
          value={userStats?.total_questions?.toLocaleString() ?? "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.total_conversations")}
          value={userStats?.total_conversations?.toLocaleString() ?? "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.most_questions_by_user")}
          value={userStats?.most_questions_by_user ?? "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.avg_questions_per_user")}
          value={userStats ? userStats.avg_questions_per_user.toFixed(1) : "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.avg_sessions_per_user")}
          value={userStats ? userStats.avg_sessions_per_user.toFixed(1) : "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.avg_convo_length")}
          value={userStats ? userStats.avg_convo_length.toFixed(1) : "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.longest_convo_length")}
          value={userStats?.longest_convo_length ?? "—"}
          loading={loading}
        />
        <StatCard
          label={t("admin.user_stats.resolution_rate")}
          value={userStats ? `${userStats.resolution_rate.toFixed(2)}%` : "—"}
          loading={loading}
        />
      </Box>
    </Box>
  );
};

export default UserStatsSection;
