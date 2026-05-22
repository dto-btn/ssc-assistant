/**
 * AdminDashboard — top-level playground admin dashboard view.
 *
 * Renders as a full-width overlay over the chat area when the admin
 * clicks the dashboard icon in the sidebar. Organized into tabs.
 */

import React from "react";
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Alert,
  CircularProgress,
  IconButton,
  Divider,
  Paper,
} from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import { setActiveTab, setShowDashboard } from "../../store/slices/adminSlice";
import { loadDashboardData } from "../../store/thunks/adminThunks";

import DateRangeFilter from "./DateRangeFilter";
import OverviewCards from "./OverviewCards";
import ToolUsageSection from "./ToolUsageSection";
import TimelineSection from "./TimelineSection";
import CallerSystemSection from "./CallerSystemSection";
import CitationMetrics from "./CitationMetrics";
import AdminManagement from "./AdminManagement";

interface TabPanelProps {
  value: number;
  index: number;
  children: React.ReactNode;
}

const TabPanel: React.FC<TabPanelProps> = ({ value, index, children }) => (
  <Box
    role="tabpanel"
    hidden={value !== index}
    id={`admin-tabpanel-${index}`}
    aria-labelledby={`admin-tab-${index}`}
    sx={{ pt: 2 }}
  >
    {value === index && children}
  </Box>
);

const AdminDashboard: React.FC = () => {
  const { t } = useTranslation("playground");
  const dispatch = useAppDispatch();
  const activeTab = useAppSelector((s) => s.admin.activeTab);
  const dateRange = useAppSelector((s) => s.admin.dateRange);
  const isLoading = useAppSelector((s) => s.admin.isLoading);
  const error = useAppSelector((s) => s.admin.error);

  // Load data on first mount
  React.useEffect(() => {
    dispatch(loadDashboardData(dateRange.start, dateRange.end));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Paper
      elevation={0}
      square
      sx={{
        position: "absolute",
        inset: 0,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        bgcolor: "background.default",
      }}
    >
      {/* Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 3,
          py: 1.5,
          borderBottom: 1,
          borderColor: "divider",
        }}
      >
        <Typography variant="h6" fontWeight="bold">
          {t("admin.title")}
        </Typography>
        <Box display="flex" alignItems="center" gap={1}>
          {isLoading && <CircularProgress size={18} />}
          <IconButton
            size="small"
            onClick={() => dispatch(setShowDashboard(false))}
            aria-label={t("admin.close")}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        </Box>
      </Box>

      {/* Date range filter */}
      <Box sx={{ px: 3, py: 1.5, borderBottom: 1, borderColor: "divider" }}>
        <DateRangeFilter />
      </Box>

      {error && (
        <Alert severity="error" sx={{ mx: 3, mt: 1 }}>
          {error}
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(_, v) => dispatch(setActiveTab(v))}
        sx={{ px: 3, borderBottom: 1, borderColor: "divider" }}
        variant="scrollable"
        scrollButtons="auto"
      >
        <Tab label={t("admin.tab.overview")} id="admin-tab-0" />
        <Tab label={t("admin.tab.tools")} id="admin-tab-1" />
        <Tab label={t("admin.tab.timeline")} id="admin-tab-2" />
        <Tab label={t("admin.tab.callers")} id="admin-tab-3" />
        <Tab label={t("admin.tab.citations")} id="admin-tab-4" />
        <Tab label={t("admin.tab.admins")} id="admin-tab-5" />
      </Tabs>

      {/* Tab content */}
      <Box sx={{ flex: 1, overflowY: "auto", px: 3, pb: 3 }}>
        <TabPanel value={activeTab} index={0}>
          <OverviewCards />
        </TabPanel>
        <TabPanel value={activeTab} index={1}>
          <ToolUsageSection />
        </TabPanel>
        <TabPanel value={activeTab} index={2}>
          <TimelineSection />
        </TabPanel>
        <TabPanel value={activeTab} index={3}>
          <CallerSystemSection />
        </TabPanel>
        <TabPanel value={activeTab} index={4}>
          <CitationMetrics />
        </TabPanel>
        <TabPanel value={activeTab} index={5}>
          <AdminManagement />
        </TabPanel>
      </Box>
    </Paper>
  );
};

export default AdminDashboard;
