/**
 * BITS (Business Request) service for the playground.
 *
 * Calls the same-origin API backend (`/api/playground/bits/business-request`), which runs
 * the BITS lookup server-side. The browser no longer opens a direct MCP connection.
 */

/**
 * Result returned by the BITS lookup endpoint. Shape is `{ br, metadata }`, matching
 * `tools/bits/bits_functions.py::get_br_information`.
 */
export interface BusinessRequestLookupResult {
  br: Array<Record<string, unknown>>;
  metadata?: Record<string, unknown>;
}

export interface GetBusinessRequestOptions {
  accessToken?: string;
}

const BITS_LOOKUP_PATH = "/api/playground/bits/business-request";

/**
 * Fetch Business Request information for a single BR number via the API backend.
 *
 * Accepts UI-facing BR variants (e.g. "BR-1234", "#1234") and normalizes to digits.
 * Returns the raw `{ br, metadata }` payload so callers can transform records.
 */
export const getBusinessRequest = async (
  br: string,
  { accessToken }: GetBusinessRequestOptions = {},
): Promise<BusinessRequestLookupResult> => {
  const normalizedBr = String(br).trim().replace(/^#?BR[-\s]?/i, "");
  const brNumberMatch = normalizedBr.match(/\d+/);
  if (!brNumberMatch) {
    throw new Error("BR must be all numbers.");
  }
  const normalizedBrNumber = Number(brNumberMatch[0]);

  const response = await fetch(BITS_LOOKUP_PATH, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: JSON.stringify({ br_numbers: [normalizedBrNumber] }),
  });

  if (!response.ok) {
    throw new Error(`BITS lookup failed with status ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const brRecords = Array.isArray(payload.br) ? (payload.br as Array<Record<string, unknown>>) : [];
  const metadata =
    payload.metadata && typeof payload.metadata === "object"
      ? (payload.metadata as Record<string, unknown>)
      : undefined;

  return { br: brRecords, metadata };
};
