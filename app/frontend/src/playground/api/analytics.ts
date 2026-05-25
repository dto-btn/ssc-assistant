/**
 * Analytics API client
 *
 * Calls the custom analytics FastAPI service for tool usage, citations,
 * caller system data, and admin management.
 */

const ANALYTICS_BASE =
  import.meta.env.VITE_ANALYTICS_API_BASE_URL || "http://localhost:4001";

function getHeaders(token?: string): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Analytics API error ${res.status}: ${body}`);
  }
  return res.json();
}

export async function checkAdmin(token?: string): Promise<{ is_admin: boolean }> {
  const res = await fetch(`${ANALYTICS_BASE}/analytics/check-admin`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function fetchOverview(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${ANALYTICS_BASE}/analytics/overview?${params}`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function fetchToolUsage(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${ANALYTICS_BASE}/analytics/tool-usage?${params}`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function fetchMcpServerUsage(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${ANALYTICS_BASE}/analytics/mcp-server-usage?${params}`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function fetchCallerSystems(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(
    `${ANALYTICS_BASE}/analytics/caller-systems?${params}`,
    { headers: getHeaders(token) }
  );
  return handleResponse(res);
}

export async function fetchCitations(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(`${ANALYTICS_BASE}/analytics/citations?${params}`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function fetchSpendTimeline(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(
    `${ANALYTICS_BASE}/analytics/spend-timeline?${params}`,
    { headers: getHeaders(token) }
  );
  return handleResponse<{ timeline: any[]; start_date: string; end_date: string }>(res);
}

export async function fetchUserStats(
  start: string,
  end: string,
  token?: string
) {
  const params = new URLSearchParams({ start, end });
  const res = await fetch(
    `${ANALYTICS_BASE}/analytics/user-stats?${params}`,
    { headers: getHeaders(token) }
  );
  return handleResponse(res);
}

export async function fetchAdminList(token?: string) {
  const res = await fetch(`${ANALYTICS_BASE}/analytics/admins`, {
    headers: getHeaders(token),
  });
  return handleResponse(res);
}

export async function addAdmin(
  oid: string,
  displayName: string,
  email: string,
  token?: string
) {
  const res = await fetch(`${ANALYTICS_BASE}/analytics/admins`, {
    method: "POST",
    headers: getHeaders(token),
    body: JSON.stringify({ oid, display_name: displayName, email }),
  });
  return handleResponse(res);
}

export async function removeAdmin(oid: string, token?: string) {
  const res = await fetch(
    `${ANALYTICS_BASE}/analytics/admins/${encodeURIComponent(oid)}`,
    {
      method: "DELETE",
      headers: getHeaders(token),
    }
  );
  return handleResponse(res);
}
