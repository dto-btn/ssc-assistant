/**
 * BITS domain helpers.
 *
 * Handles BITS-specific parsing, query-hint inference, and MCP system prompts
 * used when business-request tooling is part of the routed server set.
 */
import {
  CompletionMessage,
} from "../../services/completionService";
import {
  PlaygroundBrArtifacts,
} from "../slices/chatSlice";
import { Tool } from "openai/resources/responses/responses.mjs";
import i18n from "../../../i18n";

const MCP_GROUNDING_SYSTEM_PROMPT = [
  "You may receive source-bearing data from routed MCP servers.",
  "When MCP output includes source snippets, citation content, article passages, chunk text, page details, or document titles, treat that material as the primary evidence for your answer.",
  "Do not expand acronyms, rename systems, or substitute more familiar terminology from memory when the source material provides the official wording.",
  "If explicit source wording conflicts with the user's wording or your prior knowledge, prefer the source wording, especially for official names, acronyms, and terminology.",
  "Mention returned document titles when useful, and if the source data is sparse, ambiguous, or conflicting, state that limitation instead of filling the gap with unsupported details.",
].join(" ");

const BITS_FILTER_ENFORCEMENT_SYSTEM_PROMPT = [
  "When routed MCP tools include BITS/business-request servers, you must apply all explicit user constraints as retrieval filters before producing analysis or charts.",
  "Convert constraints such as date windows, client/organization, priority, status, phase, BR owner, and BA/OPI into query filters in the tool call payload.",
  "For month-based requests (for example, March), use an inclusive calendar date range for that month unless the user gave a different range.",
  "For chart requests, first retrieve the filtered BR dataset with those filters, then compute and render the chart from that filtered dataset.",
  "Do not silently drop or relax explicit filters. If a required filter value is ambiguous, ask a clarification question before finalizing the result.",
].join(" ");

const MONTH_INDEX_BY_NAME: Record<string, number> = {
  january: 0,
  janvier: 0,
  february: 1,
  fevrier: 1,
  march: 2,
  mars: 2,
  april: 3,
  avril: 3,
  may: 4,
  mai: 4,
  june: 5,
  juin: 5,
  july: 6,
  juillet: 6,
  august: 7,
  aout: 7,
  september: 8,
  septembre: 8,
  october: 9,
  octobre: 9,
  november: 10,
  novembre: 10,
  december: 11,
  decembre: 11,
};

const MONTH_NAMES_PATTERN = "january|janvier|february|fevrier|march|mars|april|avril|may|mai|june|juin|july|juillet|august|aout|september|septembre|october|octobre|november|novembre|december|decembre";
const PRIORITY_NORMALIZATION_MAP: Record<string, "High" | "Medium" | "Low"> = {
  high: "High",
  eleve: "High",
  elevee: "High",
  medium: "Medium",
  moyenne: "Medium",
  low: "Low",
  basse: "Low",
  faible: "Low",
};

export const BITS_TOOL_NAMES = new Set([
  "search_requests",
  "get_request_status",
  "create_request",
  "search_business_requests",
  "get_br_page",
  "valid_search_fields",
  "get_organization_names",
]);

export const BITS_NON_RESULT_TOOL_NAMES = new Set([
  "valid_search_fields",
  "get_organization_names",
]);

const normalizePromptForInference = (value: string): string => {
  // Normalize accents and casing so French and English phrasing share one parser path.
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};

export const isBrGuidancePrompt = (promptText: string): boolean => {
  const normalized = normalizePromptForInference(promptText);
  return (
    /\b(what kind of questions|what questions can i ask|what can i ask|example questions|sample questions|how can i ask)\b/.test(normalized)
    || /\b(quels? types? de questions|quelles? questions puis-je poser|que puis-je demander|exemples? de questions|comment poser)\b/.test(normalized)
  );
};

const tryParseJson = (value: string): unknown => {
  const trimmed = value.trim();
  const candidates: string[] = [trimmed];

  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    const candidate = match[1]?.trim();
    if (candidate) {
      candidates.push(candidate);
    }
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  const firstBracket = trimmed.indexOf("[");
  const lastBracket = trimmed.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) {
    candidates.push(trimmed.slice(firstBracket, lastBracket + 1));
  }

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate);
    } catch {
      continue;
    }
  }

  return undefined;
};

const hasBrArtifactKeys = (value: unknown): value is {
  br?: unknown;
  BR?: unknown;
  results?: unknown;
  metadata?: unknown;
  meta?: unknown;
  brquery?: unknown;
  brQuery?: unknown;
  brselect?: unknown;
  brSelect?: unknown;
} => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    Object.prototype.hasOwnProperty.call(record, "br")
    || Object.prototype.hasOwnProperty.call(record, "BR")
    || Object.prototype.hasOwnProperty.call(record, "results")
    || Object.prototype.hasOwnProperty.call(record, "metadata")
    || Object.prototype.hasOwnProperty.call(record, "meta")
    || Object.prototype.hasOwnProperty.call(record, "brquery")
    || Object.prototype.hasOwnProperty.call(record, "brQuery")
    || Object.prototype.hasOwnProperty.call(record, "brselect")
    || Object.prototype.hasOwnProperty.call(record, "brSelect")
  );
};

/**
 * Walk arbitrary tool payload shapes to find the first BITS artifact envelope.
 */
const findBrArtifactPayload = (value: unknown): {
  br?: unknown;
  BR?: unknown;
  results?: unknown;
  metadata?: unknown;
  meta?: unknown;
  brquery?: unknown;
  brQuery?: unknown;
  brselect?: unknown;
  brSelect?: unknown;
} | undefined => {
  if (hasBrArtifactKeys(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = tryParseJson(value);
    if (parsed !== undefined) {
      return findBrArtifactPayload(parsed);
    }
    return undefined;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findBrArtifactPayload(item);
      if (found) {
        return found;
      }
    }
    return undefined;
  }

  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      const found = findBrArtifactPayload(nested);
      if (found) {
        return found;
      }
    }
  }

  return undefined;
};

const getRecordValue = (record: Record<string, unknown>, keys: string[]): unknown => {
  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(record, key)) {
      return record[key];
    }
  }
  return undefined;
};

const isLikelyBrRow = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  // Require a BR identifier plus at least one row-like detail field.
  if (!Object.prototype.hasOwnProperty.call(record, "BR_NMBR")) {
    return false;
  }

  const brNumber = record.BR_NMBR;
  const hasScalarBrNumber = typeof brNumber === "string" || typeof brNumber === "number";
  if (!hasScalarBrNumber) {
    return false;
  }

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

  return detailKeys.some((key) => Object.prototype.hasOwnProperty.call(record, key));
};

/**
 * Parse structured BITS artifacts from MCP tool output text.
 */
export const parseBitsArtifactsFromToolOutput = (
  toolOutput: string,
): PlaygroundBrArtifacts | undefined => {
  // Accept raw JSON, fenced JSON, and nested envelopes emitted by tool responses.
  const parsed = tryParseJson(toolOutput);
  if (parsed === undefined) {
    return undefined;
  }

  const artifactPayload = findBrArtifactPayload(parsed);
  const artifacts: PlaygroundBrArtifacts = {};

  if (!artifactPayload) {
    if (Array.isArray(parsed)) {
      const rows = parsed.filter((entry): entry is Record<string, unknown> => isLikelyBrRow(entry));
      if (rows.length > 0) {
        artifacts.brData = rows;
      }
    } else if (isLikelyBrRow(parsed)) {
      artifacts.brData = [parsed];
    }

    if (!artifacts.brData) {
      return undefined;
    }

    return artifacts;
  }

  const artifactPayloadRecord = artifactPayload as Record<string, unknown>;
  const brCandidate = getRecordValue(artifactPayloadRecord, ["br", "BR", "rows", "data", "results"]);
  const metadataCandidate = getRecordValue(artifactPayloadRecord, ["metadata", "meta"]);
  const brQueryCandidate = getRecordValue(artifactPayloadRecord, ["brquery", "brQuery"]);
  const brSelectCandidate = getRecordValue(artifactPayloadRecord, ["brselect", "brSelect"]);

  if (Array.isArray(brCandidate)) {
    const rows = brCandidate.filter(
      (entry): entry is Record<string, unknown> => isLikelyBrRow(entry)
    );
    if (rows.length > 0) {
      artifacts.brData = rows;
    }
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
        (value): value is string => typeof value === "string"
      ),
    };
  }

  if (!artifacts.brData && !artifacts.brMetadata && !artifacts.brQuery && !artifacts.brSelectFields) {
    return undefined;
  }

  return artifacts;
};

export const mergeBitsArtifacts = (
  current: PlaygroundBrArtifacts,
  incoming: PlaygroundBrArtifacts,
): PlaygroundBrArtifacts => {
  // Preserve existing context while appending new row data from later tool outputs.
  const mergedBrData = [
    ...(current.brData || []),
    ...(incoming.brData || []),
  ];

  return {
    brData: mergedBrData.length > 0 ? mergedBrData : undefined,
    brMetadata: incoming.brMetadata || current.brMetadata,
    brQuery: incoming.brQuery || current.brQuery,
    brSelectFields: incoming.brSelectFields || current.brSelectFields,
  };
};

const hasBitsServer = (servers: Tool.Mcp[] = []): boolean => {
  return servers.some((server) => {
    const haystack = `${server.server_label || ""} ${server.server_description || ""} ${server.server_url || ""}`.toLowerCase();
    return haystack.includes("bits") || haystack.includes("business-request") || haystack.includes("br");
  });
};

const formatIsoDate = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const inferBitsFilterHintsFromPrompt = (promptText: string, isFrench: boolean): string[] => {
  const hints: string[] = [];
  const normalizedPrompt = normalizePromptForInference(promptText);
  const clientField = isFrench ? "RPT_GC_ORG_NAME_FR" : "RPT_GC_ORG_NAME_EN";
  const priorityField = isFrench ? "PRIORITY_FR" : "PRIORITY_EN";

  const monthMatch = normalizedPrompt.match(new RegExp(`\\b(${MONTH_NAMES_PATTERN})\\b(?:\\s+(\\d{4}))?`));
  if (monthMatch) {
    const monthName = monthMatch[1].toLowerCase();
    const monthIndex = MONTH_INDEX_BY_NAME[monthName];
    const requestedYear = monthMatch[2] ? Number.parseInt(monthMatch[2], 10) : new Date().getUTCFullYear();

    if (Number.isInteger(monthIndex) && Number.isFinite(requestedYear)) {
      const start = new Date(Date.UTC(requestedYear, monthIndex, 1));
      const end = new Date(Date.UTC(requestedYear, monthIndex + 1, 0));
      hints.push(`Date Submited (SUBMIT_DATE) >= ${formatIsoDate(start)}`);
      hints.push(`Date Submited (SUBMIT_DATE) <= ${formatIsoDate(end)}`);
    }
  }

  const clientMatch = normalizedPrompt.match(/\bclient\b\s+([a-z0-9][a-z0-9 '&().-]{1,100}?)(?=(?:\s+for\s+brs?|\s+for\s+the\s+month|\s+with\s+|\s+of\s+|\s+that\s+|\s+priority|\s+only|\s+pour\s+(?:les?\s+)?(?:do|brs?)|\s+pour\s+le\s+mois|\s+avec\s+|\s+de\s+|\s+qui\s+|\s+priorite|\s+seulement|[,.;]|$))/);
  if (clientMatch) {
    const fullMatch = clientMatch[0] || "";
    const normalizedClientCandidate = clientMatch[1] || "";
    const fullMatchStart = clientMatch.index ?? -1;
    const candidateOffset = fullMatchStart >= 0 ? fullMatch.indexOf(normalizedClientCandidate) : -1;
    const candidateStart = fullMatchStart >= 0 && candidateOffset >= 0 ? fullMatchStart + candidateOffset : -1;
    const candidateEnd = candidateStart >= 0 ? candidateStart + normalizedClientCandidate.length : -1;

    const clientCandidate = (
      candidateStart >= 0 && candidateEnd > candidateStart
        ? promptText.slice(candidateStart, candidateEnd)
        : normalizedClientCandidate
    ).trim();

    if (clientCandidate.length > 0) {
      hints.push(`Client Name candidate: ${clientCandidate} (resolve acronym/alias using get_organization_names before querying ${clientField})`);
    }
  }

  const priorityMatch = normalizedPrompt.match(/\b(high|medium|low|elevee|eleve|moyenne|basse|faible)\s+(?:priority|priorite)\b|\b(?:priority|priorite)\b\s*(?:is|est|=)?\s*(high|medium|low|elevee|eleve|moyenne|basse|faible)\b/);
  const priorityRaw = (priorityMatch?.[1] || priorityMatch?.[2] || "").toLowerCase();
  const normalizedPriority = PRIORITY_NORMALIZATION_MAP[priorityRaw];
  if (normalizedPriority) {
    hints.push(`Priority (${priorityField}) = ${normalizedPriority}`);
  }

  return hints;
};

export const dedupeMcpServers = (servers: Tool.Mcp[]): Tool.Mcp[] => {
  const seen = new Set<string>();
  const deduped: Tool.Mcp[] = [];
  for (const server of servers) {
    const key = `${server.server_url || ""}|${server.server_label || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(server);
  }
  return deduped;
};

const buildMcpGroundingSystemMessage = (
  routedServers: Tool.Mcp[],
): CompletionMessage | undefined => {
  if (routedServers.length === 0) {
    return undefined;
  }

  return {
    role: "system",
    content: MCP_GROUNDING_SYSTEM_PROMPT,
  };
};

const buildBitsFilterSystemMessage = (
  routedServers: Tool.Mcp[],
  userPrompt: string,
): CompletionMessage | undefined => {
  if (!hasBitsServer(routedServers)) {
    return undefined;
  }

  const inferredHints = inferBitsFilterHintsFromPrompt(
    userPrompt,
    i18n.language?.toLowerCase().startsWith("fr") ?? false,
  );
  const hintsBlock = inferredHints.length > 0
    ? `\nInferred query filters from the current user request (apply unless user corrects them):\n${inferredHints.map((hint) => `- ${hint}`).join("\n")}`
    : "";

  return {
    role: "system",
    content: `${BITS_FILTER_ENFORCEMENT_SYSTEM_PROMPT}${hintsBlock}`,
  };
};

export const buildCompletionMessagesForRun = ({
  baseMessages,
  routedServers,
  preflightRoutingContextMessage,
  userPrompt,
}: {
  baseMessages: CompletionMessage[];
  routedServers: Tool.Mcp[];
  preflightRoutingContextMessage?: CompletionMessage;
  userPrompt: string;
}): CompletionMessage[] => {
  // Only prepend MCP/BITS system guidance when tools are actually routed.
  if (routedServers.length === 0) {
    return baseMessages;
  }

  const groundingSystemMessage = buildMcpGroundingSystemMessage(routedServers);
  const bitsFilterSystemMessage = buildBitsFilterSystemMessage(routedServers, userPrompt);

  return [
    ...(groundingSystemMessage ? [groundingSystemMessage] : []),
    ...(bitsFilterSystemMessage ? [bitsFilterSystemMessage] : []),
    ...(preflightRoutingContextMessage ? [preflightRoutingContextMessage] : []),
    ...baseMessages,
  ];
};

export const shouldRequireToolsForRun = (routedServers: Tool.Mcp[]): boolean => {
  return hasBitsServer(routedServers);
};
