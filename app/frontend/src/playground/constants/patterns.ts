/**
 * Shared regex patterns and lookup tables used across the playground.
 *
 * Centralizing these avoids duplication between assistantThunks, sessionExport,
 * ChatMessages, and the citation utilities.
 */

// ---------------------------------------------------------------------------
// Stream / tool-call
// ---------------------------------------------------------------------------

/** Matches transient tool-call status lines injected during streaming. */
export const TOOL_CALL_STATUS_PATTERN = /\n[^\n]* is being called\.\.\.\n/g;

// ---------------------------------------------------------------------------
// Citation enrichment
// ---------------------------------------------------------------------------

/** Prefix used for synthesized local-citation placeholder URLs. */
export const LOCAL_CITATION_PREFIX = "local-citation://";

/** Matches prompts that are likely asking about EPS (Enterprise Portfolio System). */
export const EPS_QUERY_PATTERN =
  /\b(enterprise\s+(project|portfolio)\s+system|eps)\b/i;

/** Matches prompts that are likely asking about PMCOE / project management. */
export const PMCOE_QUERY_PATTERN =
  /\b(pmcoe|project management|operating guide|gate review|through the gates?|opmca)\b/i;

// ---------------------------------------------------------------------------
// Mermaid
// ---------------------------------------------------------------------------

/**
 * Extracts fenced mermaid code blocks from a markdown string.
 *
 * Shared between ChatMessages.tsx (inline detection) and sessionExport.ts
 * (diagram extraction for PDF/Word export). Use with the `gi` flags when
 * iterating multiple matches via `matchAll` or `exec`.
 */
export const MERMAID_FENCE_PATTERN = /```mermaid\s*([\s\S]*?)```/gi;

/**
 * Matches the first-line directive/header tokens of a Mermaid diagram.
 * Used to skip non-data lines when parsing Mermaid blocks as tabular data.
 */
export const MERMAID_DIAGRAM_TYPE_PATTERN =
  /^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|mindmap|timeline|gitGraph|xychart-beta)\b/i;

// ---------------------------------------------------------------------------
// BITS / Business Request date & filter inference
// ---------------------------------------------------------------------------

/**
 * Pipe-separated list of month names (English and French) for regex use.
 * Used inside {@link BITS_MONTH_PATTERN}.
 */
export const MONTH_NAMES_PATTERN =
  "january|janvier|february|fevrier|march|mars|april|avril|may|mai|june|juin|july|juillet|august|aout|september|septembre|october|octobre|november|novembre|december|decembre";

/** Maps lowercase month names (EN + FR) to zero-based month indices. */
export const MONTH_INDEX_BY_NAME: Readonly<Record<string, number>> = {
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

/**
 * Maps lowercase priority terms (EN + FR) to their canonical capitalized form.
 * Used when inferring BITS filter hints from free-text prompts.
 */
export const PRIORITY_NORMALIZATION_MAP: Readonly<
  Record<string, "High" | "Medium" | "Low">
> = {
  high: "High",
  eleve: "High",
  elevee: "High",
  medium: "Medium",
  moyenne: "Medium",
  low: "Low",
  basse: "Low",
  faible: "Low",
};
