/**
 * Citation metrics timeline section for the admin dashboard.
 */

import React from "react";
import { Box, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "../../store/hooks";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

const CitationMetrics: React.FC = () => {
  const { t } = useTranslation("playground");
  const timeline = useAppSelector((s) => s.admin.citationTimeline);

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("admin.citations.title")}
      </Typography>
      {timeline.length === 0 ? (
        <Typography variant="body2" color="text.secondary">
          {t("admin.no_data")}
        </Typography>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={timeline} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar
              dataKey="annotation_count"
              name={t("admin.citations.annotations")}
              fill="#0288d1"
              stackId="a"
            />
            <Bar
              dataKey="url_citation_count"
              name={t("admin.citations.url_citations")}
              fill="#26a69a"
              stackId="a"
            />
            <Bar
              dataKey="citation_like_record_count"
              name={t("admin.citations.citation_records")}
              fill="#8d6e63"
              stackId="a"
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </Box>
  );
};

export default CitationMetrics;
