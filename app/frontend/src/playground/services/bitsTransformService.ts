/**
 * BITS (Business Information Tracking System) transform service.
 *
 * Extracted from assistantThunks.ts — isolates all BITS / Business Request
 * artifact parsing, field inference, and filter hint generation so the thunk
 * file can act as a thin orchestrator.
 *
 * Public surface:
 *   - BITS_TOOL_NAMES
 *   - BITS_NON_RESULT_TOOL_NAMES
 *   - parseBitsArtifactsFromToolOutput
 *   - mergeBitsArtifacts
 *   - hasBitsServer
 *   - inferBitsFilterHintsFromPrompt
 *   - isBrGuidancePrompt
 */

import type { Tool } from "openai/resources/responses/responses.mjs";
import type { PlaygroundBrArtifacts } from "../store/slices/chatSlice";
import { tryParseJson } from "../utils/json";
import { normalizePromptForInference } from "../utils/promptUtils";
import {
  MONTH_INDEX_BY_NAME,
  MONTH_NAMES_PATTERN,
  PRIORITY_NORMALIZATION_MAP,
} from "../constants/patterns";

// ---------------------------------------------------------------------------
// Tool name sets
// ---------------------------------------------------------------------------

export const BITS_TOOL_NAMES = new Set([
  "search_requests",
  "get_request_status",
  "create_request",
  "search_business_requests",
  "get_br_page",
  "valid_search_fields",
  "get_organization_names",
]);

/**
 * BITS tool calls that return schema/meta information rather than BR rows.
 * These should not trigger artifact extraction.
 */
export const BITS_NON_RESULT_TOOL_NAMES = new Set([
  "valid_search_fields",
  "get_organization_names",
]);

// ---------------------------------------------------------------------------
// Private helpers — shape detection
// ---------------------------------------------------------------------------

type BrArtifactEnvelope = {
  br?: unknown;
  BR?: unknown;
  results?: unknown;
  metadata?: unknown;
  meta?: unknown;
  brquery?: unknown;
  brQuery?: unknown;
  brselect?: unknown;
  brSelect?: unknown;
};

const hasBrArtifactKeys = (value: unknown): value is BrArtifactEnvelope => {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  return (
    Object.prototype.hasOwnProperty.call(r, "br")
    || Object.prototype.hasOwnProperty.call(r, "BR")
    || Object.prototype.hasOwnProperty.call(r, "results")
    || Object.prototype.hasOwnProperty.call(r, "metadata")
    || Object.prototype.hasOwnProperty.call(r, "meta")
    || Object.prototype.hasOwnProperty.call(r, "brquery")
    || Object.prototype.hasOwnProperty.call(r, "brQuery")
    || Object.prototype.hasOwnProperty.call(r, "brselect")
    || Object.prototype.hasOwnProperty.call(r, "brSelect")
  );
};

/** Walk an arbitrary payload tree to locate the first BR artifact envelope. */
const findBrArtifactPayload = (value: unknown): BrArtifactEnvelope | undefined => {
  if (hasBrArtifactKeys(value)) return value;

  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    return parsed !== undefined ? findBrArtifactPayload(parsed) : undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBrArtifactPayload(item);
      if (found) return found;
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const found = findBrArtifactPayload(nested);
      if (found) return found;
    }
  }

  return undefined;
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return record[key];
  }
  return undefined;
};

/**
 * Return true when the value looks like a BITS business-request row.
 * Requires a scalar BR_NMBR plus at least one row-detail field to prevent
 * false positives from field-definition payloads.
 */
const isLikelyBrRow = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") return false;
  const r = value as Record<string, unknown>;
  if (!Object.prototype.hasOwnProperty.call(r, "BR_NMBR")) return false;

  const brNumber = r.BR_NMBR;
  if (typeof brNumber !== "string" && typeof brNumber !== "number") return false;

  const detailKeys = [
    "BR_SHORT_TITLE",
    "BITS_STATUS_EN",
    "BITS_STATUS_FR",
    "SUBMIT_DATE",
    "RPT_GC_ORG_NAME_EN",
    "RPT_GC_ORG_NAME_FR",
    "PRIORITY_EN",
    "PRIORITY_FR",
  ];
  return detailKeys.some((key) => Object.prototype.hasOwnProperty.call(r, key));
};

// ---------------------------------------------------------------------------
// Private helpers — date utilities
// ---------------------------------------------------------------------------

export const formatIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Parse BITS artifacts from raw MCP tool output text.
 * Supports flat row arrays and wrapped payloads (`br`, `metadata`, `brquery`,
 * `brselect`).
 */
export const parseBitsArtifactsFromToolOutput = (
  toolOutput: string,
): PlaygroundBrArtifacts | undefined => {
  const parsed = tryParseJson(toolOutput);
  if (parsed === undefined) return undefined;

  const artifactPayload = findBrArtifactPayload(parsed);
  const artifacts: PlaygroundBrArtifacts = {};

  if (!artifactPayload) {
    if (Array.isArray(parsed)) {
      const rows = parsed.filter((entry): entry is Record<string, unknown> =>
        isLikelyBrRow(entry),
      );
      if (rows.length > 0) artifacts.brData = rows;
    } else if (isLikelyBrRow(parsed)) {
      artifacts.brData = [parsed];
    }
    return artifacts.brData ? artifacts : undefined;
  }

  const envelope = artifactPayload as Record<string, unknown>;

  const brCandidate = getRecordValue(envelope, ["br", "BR", "rows", "data", "results"]);
  const metadataCandidate = getRecordValue(envelope, ["metadata", "meta"]);
  const brQueryCandidate = getRecordValue(envelope, ["brquery", "brQuery"]);
  const brSelectCandidate = getRecordValue(envelope, ["brselect", "brSelect"]);

  if (Array.isArray(brCandidate)) {
    const rows = brCandidate.filter((entry): entry is Record<string, unknown> =>
      isLikelyBrRow(entry),
    );
    if (rows.length > 0) artifacts.brData = rows;
  }

  if (metadataCandidate && typeof metadataCandidate === "object") {
    artifacts.brMetadata = metadataCandidate as Record<string, unknown>;
  }

  if (brQueryCandidate && typeof brQueryCandidate === "object") {
    artifacts.brQuery = brQueryCandidate as Record<string, unknown>;
  }

  if (
    brSelectCandidate
    && typeof brSelectCandidate === "object"
    && Array.isArray((brSelectCandidate as { fields?: unknown }).fields)
  ) {
    artifacts.brSelectFields = {
      fields: (brSelectCandidate as { fields: unknown[] }).fields.filter(
        (v): v is string => typeof v === "string",
      ),
    };
  }

  if (
    !artifacts.brData
    && !artifacts.brMetadata
    && !artifacts.brQuery
    && !artifacts.brSelectFields
  ) {
    return undefined;
  }

  return artifacts;
};

/**
 * Merge incremental BITS artifact payloads, preserving prior context across
 * retries and streaming chunks.
 */
export const mergeBitsArtifacts = (
  current: PlaygroundBrArtifacts,
  incoming: PlaygroundBrArtifacts,
): PlaygroundBrArtifacts => {
  const mergedBrData = [
    ...(current.brData ?? []),
    ...(incoming.brData ?? []),
  ];

  return {
    brData: mergedBrData.length > 0 ? mergedBrData : undefined,
    brMetadata: incoming.brMetadata ?? current.brMetadata,
    brQuery: incoming.brQuery ?? current.brQuery,
    brSelectFields: incoming.brSelectFields ?? current.brSelectFields,
  };
};

/**
 * Merge enriched BR rows into the base result set, keyed on BR_NMBR.
 *
 * Enriched fields take precedence over base fields for the same BR number.
 * Base rows without a matching enriched entry are preserved unchanged so that
 * partially-enriched lists do not silently drop BRs.
 */
export const mergeBrDataByBrNumber = (
  base: Record<string, unknown>[],
  enriched: Record<string, unknown>[],
): Record<string, unknown>[] => {
  if (enriched.length === 0) return base;
  const enrichedMap = new Map<string, Record<string, unknown>>();
  for (const row of enriched) {
    const key = String(row.BR_NMBR ?? "");
    if (key) enrichedMap.set(key, row);
  }
  return base.map((row) => {
    const key = String(row.BR_NMBR ?? "");
    const enrichedRow = key ? enrichedMap.get(key) : undefined;
    return enrichedRow ? { ...row, ...enrichedRow } : row;
  });
};

/**
 * Return true when any of the routed MCP servers appears to serve BITS data.
 */
export const hasBitsServer = (servers: Tool.Mcp[] = []): boolean =>
  servers.some((server) => {
    const haystack =
      `${server.server_label ?? ""} ${server.server_description ?? ""} ${server.server_url ?? ""}`.toLowerCase();
    return (
      haystack.includes("bits")
      || haystack.includes("business-request")
      || haystack.includes("br")
    );
  });

/**
 * Return true when the prompt is asking for guidance on what questions to ask
 * rather than requesting actual BR data.
 */
export const isBrGuidancePrompt = (promptText: string): boolean => {
  const normalized = normalizePromptForInference(promptText);
  return (
    /\b(what kind of questions|what questions can i ask|what can i ask|example questions|sample questions|how can i ask)\b/.test(normalized)
    || /\b(quels? types? de questions|quelles? questions puis-je poser|que puis-je demander|exemples? de questions|comment poser)\b/.test(normalized)
  );
};

/**
 * Inspect the prompt text and return structured filter hints that can be
 * prepended to BITS tool call payloads to ensure explicit constraints are
 * applied before generating analysis or charts.
 *
 * Detects: month/year date windows, client name candidates, and priority level.
 */
export const inferBitsFilterHintsFromPrompt = (
  promptText: string,
  isFrench: boolean,
): string[] => {
  const hints: string[] = [];
  const normalizedPrompt = normalizePromptForInference(promptText);
  const clientField = isFrench ? "RPT_GC_ORG_NAME_FR" : "RPT_GC_ORG_NAME_EN";
  const priorityField = isFrench ? "PRIORITY_FR" : "PRIORITY_EN";

  // Month / year date window
  const monthMatch = normalizedPrompt.match(
    new RegExp(`\\b(${MONTH_NAMES_PATTERN})\\b(?:\\s+(\\d{4}))?`),
  );
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const monthIndex = MONTH_INDEX_BY_NAME[monthName];
    const requestedYear = monthMatch[2]
      ? Number.parseInt(monthMatch[2], 10)
      : new Date().getUTCFullYear();

    if (Number.isInteger(monthIndex) && Number.isFinite(requestedYear)) {
      const start = new Date(Date.UTC(requestedYear, monthIndex, 1));
      const end = new Date(Date.UTC(requestedYear, monthIndex + 1, 0));
      hints.push(`Date Submited (SUBMIT_DATE) >= ${formatIsoDate(start)}`);
      hints.push(`Date Submited (SUBMIT_DATE) <= ${formatIsoDate(end)}`);
    }
  }

  // Client name
  const clientMatch = normalizedPrompt.match(
    /\bclient\b\s+([a-z0-9][a-z0-9 '&().-]{1,100}?)(?=(?:\s+for\s+brs?|\s+for\s+the\s+month|\s+with\s+|\s+of\s+|\s+that\s+|\s+priority|\s+only|\s+pour\s+(?:les?\s+)?(?:do|brs?)|\s+pour\s+le\s+mois|\s+avec\s+|\s+de\s+|\s+qui\s+|\s+priorite|\s+seulement|[,.;]|$))/,
  );
  if (clientMatch) {
    const fullMatch = clientMatch[0] ?? "";
    const normalizedClientCandidate = clientMatch[1] ?? "";
    const fullMatchStart = clientMatch.index ?? -1;
    const candidateOffset =
      fullMatchStart >= 0 ? fullMatch.indexOf(normalizedClientCandidate) : -1;
    const candidateStart =
      fullMatchStart >= 0 && candidateOffset >= 0
        ? fullMatchStart + candidateOffset
        : -1;
    const candidateEnd =
      candidateStart >= 0 ? candidateStart + normalizedClientCandidate.length : -1;

    const clientCandidate = (
      candidateStart >= 0 && candidateEnd > candidateStart
        ? promptText.slice(candidateStart, candidateEnd)
        : normalizedClientCandidate
    ).trim();

    if (clientCandidate.length > 0) {
      hints.push(
        `Client Name candidate: ${clientCandidate} (resolve acronym/alias using get_organization_names before querying ${clientField})`,
      );
    }
  }

  // Priority
  const priorityMatch = normalizedPrompt.match(
    /\b(high|medium|low|elevee|eleve|moyenne|basse|faible)\s+(?:priority|priorite)\b|\b(?:priority|priorite)\b\s*(?:is|est|=)?\s*(high|medium|low|elevee|eleve|moyenne|basse|faible)\b/,
  );
  const priorityRaw = (priorityMatch?.[1] ?? priorityMatch?.[2] ?? "").toLowerCase();
  const normalizedPriority = PRIORITY_NORMALIZATION_MAP[priorityRaw];
  if (normalizedPriority) {
    hints.push(`Priority (${priorityField}) = ${normalizedPriority}`);
  }

  return hints;
};
