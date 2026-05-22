/**
 * Tool usage breakdown section for the admin dashboard.
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../store/hooks";
import { SimpleBarChart } from "../../../components/chart/SimpleBarChart";
import { SimpleDataTable } from "../../../components/chart/SimpleDataTable";

const ToolUsageSection: React.FC = () => {
  const { t } = useTranslation("playground");
  const toolUsage = useAppSelector((s) => s.admin.toolUsage);

  if (!toolUsage.length) {
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {t("admin.tool_usage.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("admin.no_data")}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("admin.tool_usage.title")}
      </Typography>
      <Box display="flex" gap={3} flexWrap="wrap" alignItems="flex-start">
        <SimpleBarChart
          title={t("admin.tool_usage.chart_title")}
          data={toolUsage}
          xKey="tool_name"
          yKey="total_usage_count"
          color="#1976d2"
        />
        <SimpleDataTable
          data={toolUsage}
          columnMappings={[
            { headerLabel: t("admin.tool_usage.tool"), key: "tool_name" },
            {
              headerLabel: t("admin.tool_usage.conversations"),
              key: "conversation_count",
            },
            {
              headerLabel: t("admin.tool_usage.total_calls"),
              key: "total_usage_count",
            },
            {
              headerLabel: t("admin.tool_usage.unique_users"),
              key: "unique_users",
            },
          ]}
        />
      </Box>
    </Box>
  );
};

export default ToolUsageSection;
