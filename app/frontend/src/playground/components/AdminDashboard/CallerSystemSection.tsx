/**
 * Caller system breakdown section for the admin dashboard.
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../store/hooks";
import { SimpleBarChart } from "../../../components/chart/SimpleBarChart";
import { SimpleDataTable } from "../../../components/chart/SimpleDataTable";

const CallerSystemSection: React.FC = () => {
  const { t } = useTranslation("playground");
  const callerSystems = useAppSelector((s) => s.admin.callerSystems);

  if (!callerSystems.length) {
    return (
      <Box>
        <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
          {t("admin.caller_systems.title")}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {t("admin.no_data")}
        </Typography>
      </Box>
    );
  }

  const chartData = callerSystems.map((s) => ({
    label: [s.caller_system, s.caller_component].filter(Boolean).join(" / ") || "unknown",
    request_count: s.request_count,
    total_tokens: s.total_tokens,
  }));

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("admin.caller_systems.title")}
      </Typography>
      <Box display="flex" gap={3} flexWrap="wrap" alignItems="flex-start">
        <SimpleBarChart
          title={t("admin.caller_systems.chart_title")}
          data={chartData}
          xKey="label"
          yKey="request_count"
          color="#388e3c"
        />
        <SimpleDataTable
          data={callerSystems}
          columnMappings={[
            { headerLabel: t("admin.caller_systems.system"), key: "caller_system" },
            { headerLabel: t("admin.caller_systems.component"), key: "caller_component" },
            { headerLabel: t("admin.caller_systems.requests"), key: "request_count" },
            { headerLabel: t("admin.caller_systems.tokens"), key: "total_tokens" },
            {
              headerLabel: t("admin.caller_systems.cost"),
              key: "total_cost",
              renderer: (v: number) => `$${(v ?? 0).toFixed(4)}`,
            },
          ]}
        />
      </Box>
    </Box>
  );
};

export default CallerSystemSection;
