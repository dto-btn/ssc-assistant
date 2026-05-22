/**
 * Date range filter for the admin dashboard.
 */

import React from "react";
import { Box, TextField, Button, Typography } from "@mui/material";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setDateRange } from "../../store/slices/adminSlice";
import { loadDashboardData } from "../../store/thunks/adminThunks";

const DateRangeFilter: React.FC = () => {
  const { t } = useTranslation("playground");
  const dispatch = useAppDispatch();
  const dateRange = useAppSelector((s) => s.admin.dateRange);

  const [localStart, setLocalStart] = React.useState(dateRange.start);
  const [localEnd, setLocalEnd] = React.useState(dateRange.end);

  const handleApply = () => {
    dispatch(setDateRange({ start: localStart, end: localEnd }));
    dispatch(loadDashboardData(localStart, localEnd));
  };

  return (
    <Box display="flex" alignItems="center" gap={2} flexWrap="wrap">
      <Typography variant="body2" color="text.secondary">
        {t("admin.date.range")}
      </Typography>
      <TextField
        type="date"
        size="small"
        label={t("admin.date.start")}
        value={localStart}
        onChange={(e) => setLocalStart(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <TextField
        type="date"
        size="small"
        label={t("admin.date.end")}
        value={localEnd}
        onChange={(e) => setLocalEnd(e.target.value)}
        InputLabelProps={{ shrink: true }}
      />
      <Button variant="contained" size="small" onClick={handleApply}>
        {t("admin.date.apply")}
      </Button>
    </Box>
  );
};

export default DateRangeFilter;
