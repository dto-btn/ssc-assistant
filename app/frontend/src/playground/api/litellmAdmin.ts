/**
 * LiteLLM built-in admin API client
 *
 * Calls LiteLLM's native endpoints for spend tracking, model info,
 * and daily activity reports. Uses the same base URL as the playground
 * AI client but targets non-/v1 admin paths.
 */

/** Strip /v1 suffix to get the proxy root for admin endpoints. */
function getBaseUrl(): string {
  const v1Url =
    import.meta.env.VITE_PLAYGROUND_LITELLM_BASE_URL ||
    "http://localhost:4000/v1";
  return v1Url.replace(/\/v1\/?$/, "");
}

function getHeaders(): HeadersInit {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const proxyKey = import.meta.env.VITE_PLAYGROUND_LITELLM_PROXY_KEY;
  if (proxyKey) {
    headers["Authorization"] = `Bearer ${proxyKey}`;
  }
  return headers;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`LiteLLM API error ${res.status}: ${body}`);
  }
  return res.json();
}

/** Fetch spend logs from LiteLLM's built-in /spend/logs endpoint. */
export async function fetchSpendLogs(startDate: string, endDate: string) {
  const base = getBaseUrl();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  const res = await fetch(`${base}/spend/logs?${params}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

/** Fetch model info from LiteLLM's /model/info endpoint. */
export async function fetchModelInfo() {
  const base = getBaseUrl();
  const res = await fetch(`${base}/model/info`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}

/** Fetch daily activity from LiteLLM's /user/daily/activity endpoint. */
export async function fetchDailyActivity(startDate: string, endDate: string) {
  const base = getBaseUrl();
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
  });
  const res = await fetch(`${base}/user/daily/activity?${params}`, {
    headers: getHeaders(),
  });
  return handleResponse(res);
}
