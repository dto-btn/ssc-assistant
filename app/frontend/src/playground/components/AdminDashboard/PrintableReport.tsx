/**
 * PrintableReport — a print-optimised summary of dashboard data.
 *
 * Hidden on screen; visible only when the browser print dialog is open
 * (controlled via @media print CSS).  Call window.print() to trigger it.
 *
 * Renders three sections that mirror the text-report examples:
 *   USER STATS / OVERVIEW METRICS / TOOL USAGE
 */

import React from "react";
import { useAppSelector } from "../../store/hooks";

const HR = "-------------------------------------------------------------";
const HR_SHORT = "-----------------------------";

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div style={{ fontFamily: "monospace", fontSize: "13px", marginBottom: "2em" }}>
    <div>{HR}</div>
    <div style={{ textAlign: "center" }}>{`${HR_SHORT}${title}${HR_SHORT}`}</div>
    <div>{HR}</div>
    {children}
  </div>
);

const Row: React.FC<{ label: string; value: string | number }> = ({ label, value }) => (
  <div>{`${label}: ${value}`}</div>
);

const PrintableReport: React.FC = () => {
  const overview = useAppSelector((s) => s.admin.overview);
  const userStats = useAppSelector((s) => s.admin.userStats);
  const toolUsage = useAppSelector((s) => s.admin.toolUsage);
  const dateRange = useAppSelector((s) => s.admin.dateRange);

  return (
    <div
      style={{ display: "none" }}
      className="printable-report"
    >
      {/* USER STATS */}
      <Section title="USER STATS">
        {userStats && userStats.unique_users > 0 ? (
          <>
            <Row label="Date range" value={`${dateRange.start} to ${dateRange.end}`} />
            <Row label="Unique user(s)" value={userStats.unique_users} />
            <Row label="Most questions asked by a user" value={userStats.most_questions_by_user} />
            <Row label="Average questions asked" value={userStats.avg_questions_per_user.toFixed(0)} />
            <Row label="Average sessions per user" value={userStats.avg_sessions_per_user.toFixed(0)} />
            <Row label="Average convo length" value={userStats.avg_convo_length.toFixed(0)} />
            <Row label="Longest convo length" value={userStats.longest_convo_length} />
            <Row label="Conversations total" value={userStats.total_conversations} />
            <Row label="Resolution rate" value={userStats.resolution_rate} />
            <Row label="Total questions" value={userStats.total_questions} />
          </>
        ) : (
          <div>No user data available for this date range.</div>
        )}
      </Section>

      {/* OVERVIEW METRICS */}
      {overview && (
        <Section title="OVERVIEW METRICS">
          <Row label="Date range" value={`${dateRange.start} to ${dateRange.end}`} />
          <Row label="Total requests" value={overview.total_requests.toLocaleString()} />
          <Row label="Total tokens" value={overview.total_tokens.toLocaleString()} />
          <Row label="Total cost" value={`$${overview.total_cost.toFixed(4)}`} />
          <Row label="Avg latency" value={`${overview.avg_latency_ms} ms`} />
          <Row label="p50 latency" value={`${overview.p50_latency_ms} ms`} />
          <Row label="p95 latency" value={`${overview.p95_latency_ms} ms`} />
          <Row label="p99 latency" value={`${overview.p99_latency_ms} ms`} />
          <Row label="Error count" value={overview.error_count} />
          <Row label="Error rate" value={`${overview.error_rate}%`} />
        </Section>
      )}

      {/* TOOL USAGE */}
      {toolUsage.length > 0 && (
        <Section title="TOOL USAGE">
          <Row label="Date range" value={`${dateRange.start} to ${dateRange.end}`} />
          {toolUsage.map((tool) => (
            <div key={tool.tool_name} style={{ marginTop: "0.75em" }}>
              <div>{HR_SHORT}</div>
              <Row label="Tool" value={tool.tool_name} />
              <Row label={`Conversations with '${tool.tool_name}' tool usage`} value={tool.conversation_count} />
              <Row label={`Total '${tool.tool_name}' tool usage count`} value={tool.total_usage_count} />
              <Row label="Unique users" value={tool.unique_users} />
            </div>
          ))}
        </Section>
      )}
    </div>
  );
};

export default PrintableReport;
