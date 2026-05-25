/**
 * Admin dashboard Redux slice
 *
 * Manages state for the playground admin dashboard including admin status,
 * dashboard data, and admin user management.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ToolUsageItem {
  tool_name: string;
  conversation_count: number;
  total_usage_count: number;
  unique_users: number;
}

export interface McpServerUsageItem {
  server_label: string;
  conversation_count: number;
  total_usage_count: number;
  unique_users: number;
}

export interface OverviewData {
  total_requests: number;
  total_tokens: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_cost: number;
  avg_latency_ms: number;
  p50_latency_ms: number;
  p95_latency_ms: number;
  p99_latency_ms: number;
  error_count: number;
  error_rate: number;
  start_date: string;
  end_date: string;
}

export interface CallerSystemItem {
  caller_system: string | null;
  caller_component: string | null;
  request_count: number;
  total_tokens: number;
  total_cost: number;
}

export interface CitationTimelineItem {
  date: string;
  annotation_count: number;
  url_citation_count: number;
  citation_like_record_count: number;
}

export interface SpendTimelineItem {
  date: string;
  requests: number;
  tokens: number;
  cost: number;
  avg_latency_ms: number;
}

export interface UserStatsData {
  unique_users: number;
  most_questions_by_user: number;
  avg_questions_per_user: number;
  avg_sessions_per_user: number;
  avg_convo_length: number;
  longest_convo_length: number;
  total_conversations: number;
  resolution_rate: number;
  total_questions: number;
  start_date: string;
  end_date: string;
}

export interface LiteLLMSpendLog {
  request_id: string;
  api_key: string;
  model: string;
  spend: number;
  total_tokens: number;
  prompt_tokens: number;
  completion_tokens: number;
  startTime: string;
  endTime: string;
}

export interface AdminUser {
  oid: string;
  display_name: string | null;
  email: string | null;
  added_by_oid: string | null;
  added_at: string | null;
}

export interface DateRange {
  start: string; // ISO date string YYYY-MM-DD
  end: string;
}

export interface AdminState {
  isAdmin: boolean;
  isCheckingAdmin: boolean;
  showDashboard: boolean;

  // Data
  overview: OverviewData | null;
  toolUsage: ToolUsageItem[];
  mcpServerUsage: McpServerUsageItem[];
  callerSystems: CallerSystemItem[];
  citationTimeline: CitationTimelineItem[];
  spendLogs: LiteLLMSpendLog[];
  spendTimeline: SpendTimelineItem[];
  userStats: UserStatsData | null;

  // Admin management
  adminList: AdminUser[];

  // UI state
  isLoading: boolean;
  error: string | null;
  dateRange: DateRange;
  activeTab: number;
}

function defaultDateRange(): DateRange {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 30);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

const initialState: AdminState = {
  isAdmin: false,
  isCheckingAdmin: true,
  showDashboard: false,

  overview: null,
  toolUsage: [],
  mcpServerUsage: [],
  callerSystems: [],
  citationTimeline: [],
  spendLogs: [],
  spendTimeline: [],
  userStats: null,

  adminList: [],

  isLoading: false,
  error: null,
  dateRange: defaultDateRange(),
  activeTab: 0,
};

const adminSlice = createSlice({
  name: "admin",
  initialState,
  reducers: {
    setIsAdmin(state, action: PayloadAction<boolean>) {
      state.isAdmin = action.payload;
      state.isCheckingAdmin = false;
    },
    setIsCheckingAdmin(state, action: PayloadAction<boolean>) {
      state.isCheckingAdmin = action.payload;
    },
    toggleDashboard(state) {
      state.showDashboard = !state.showDashboard;
    },
    setShowDashboard(state, action: PayloadAction<boolean>) {
      state.showDashboard = action.payload;
    },
    setOverview(state, action: PayloadAction<OverviewData>) {
      state.overview = action.payload;
    },
    setToolUsage(state, action: PayloadAction<ToolUsageItem[]>) {
      state.toolUsage = action.payload;
    },
    setMcpServerUsage(state, action: PayloadAction<McpServerUsageItem[]>) {
      state.mcpServerUsage = action.payload;
    },
    setCallerSystems(state, action: PayloadAction<CallerSystemItem[]>) {
      state.callerSystems = action.payload;
    },
    setCitationTimeline(state, action: PayloadAction<CitationTimelineItem[]>) {
      state.citationTimeline = action.payload;
    },
    setSpendLogs(state, action: PayloadAction<LiteLLMSpendLog[]>) {
      state.spendLogs = action.payload;
    },
    setSpendTimeline(state, action: PayloadAction<SpendTimelineItem[]>) {
      state.spendTimeline = action.payload;
    },
    setUserStats(state, action: PayloadAction<UserStatsData>) {
      state.userStats = action.payload;
    },
    setAdminList(state, action: PayloadAction<AdminUser[]>) {
      state.adminList = action.payload;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.isLoading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    setDateRange(state, action: PayloadAction<DateRange>) {
      state.dateRange = action.payload;
    },
    setActiveTab(state, action: PayloadAction<number>) {
      state.activeTab = action.payload;
    },
  },
});

export const {
  setIsAdmin,
  setIsCheckingAdmin,
  toggleDashboard,
  setShowDashboard,
  setOverview,
  setToolUsage,
  setMcpServerUsage,
  setCallerSystems,
  setCitationTimeline,
  setSpendLogs,
  setSpendTimeline,
  setUserStats,
  setAdminList,
  setLoading,
  setError,
  setDateRange,
  setActiveTab,
} = adminSlice.actions;

export default adminSlice.reducer;
