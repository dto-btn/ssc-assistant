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
  const mcpServerUsage = useAppSelector((s) => s.admin.mcpServerUsage);

  return (
    <Box display="flex" flexDirection="column" gap={4}>
      {/* MCP server-level bar chart */}
      {mcpServerUsage.length > 0 && (
        <Box>
          <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
            {t("admin.mcp_server_usage.title")}
          </Typography>
          <SimpleBarChart
            title={t("admin.mcp_server_usage.chart_title")}
            data={mcpServerUsage}
            xKey="server_label"
            yKey="total_usage_count"
            color="#7b1fa2"
          />
        </Box>
      )}

      {/* Individual tool function breakdown */}
      {toolUsage.length > 0 ? (
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
      ) : (
        !mcpServerUsage.length && (
          <Box>
            <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
              {t("admin.tool_usage.title")}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t("admin.no_data")}
            </Typography>
          </Box>
        )
      )}
    </Box>
  );
};

export default ToolUsageSection;
