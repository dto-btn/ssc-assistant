/**
 * Citation enrichment service.
 *
 * Extracted from assistantThunks.ts — isolates the EPS/PMCOE citation
 * detection, quality checks, merging, and fallback logic so that
 * the thunk file can act as a thin orchestrator.
 *
 * Public surface:
 *   - isLikelyEpsCitationQuery
 *   - isLikelyPmcoeCitationQuery
 *   - hasRequiredEpsLegacyCitations
 *   - shouldEnrichEpsCitations
 *   - shouldEnrichPmcoeCitations
 *   - mergeCitationsPreferConcreteUrls
 *   - stripSyntheticCitationsWhenConcreteExists
 *   - CANONICAL_EPS_CITATION_FALLBACK
 */

import type { Citation } from "../utils/citations";
import {
  EPS_QUERY_PATTERN,
  LOCAL_CITATION_PREFIX,
  PMCOE_QUERY_PATTERN,
} from "../constants/patterns";

// ---------------------------------------------------------------------------
// Private constants
// ---------------------------------------------------------------------------

const MIN_EPS_CONCRETE_SOURCE_COUNT = 3;
const MIN_PMCOE_CONCRETE_SOURCE_COUNT = 2;

const REQUIRED_EPS_LEGACY_CITATION_URLS = [
  "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
  "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
] as const;

// ---------------------------------------------------------------------------
// Public constants
// ---------------------------------------------------------------------------

/**
 * Static EPS fallback citations used only when enrichment cannot recover
 * enough authoritative concrete sources. Keep synchronised with the approved
 * source-of-truth content pipeline.
 */
export const CANONICAL_EPS_CITATION_FALLBACK: Citation[] = [
  {
    title: "Enterprise Portfolio System",
    url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
    content:
      "Enterprise Portfolio System Primary users: SSC employees. The Enterprise Portfolio System (EPS) is a server-based application available to all Shared Services Canada employees. It is a licensed product, which means each user must have a valid licence or authorization. EPS is SSC's standard tool to manage projects and includes functionality to support operational and transformational goals, service/work package delivery, portfolio planning, reporting, governance, workforce/capacity planning, and audit/search traceability. Access options include EPS login, CIO Intake Team access request, and requesting a new EPS module via Submit a Request.",
  },
  {
    title: "Enterprise portfolio system training",
    url: "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
    content:
      "Enterprise portfolio system training Primary users: Project management. EPS is SSC's system of record for all projects and supports program/project/activity management with centralized project artefacts, risk/issue/change tracking, and financial/schedule visibility. A one-day training session covers navigation, project updates, team/schedule/cost plan management, ROD, timesheets, expense transactions, risks/issues/changes, document collaboration, status reporting, reporting/portlet personalization, and support pathways. Sessions are offered monthly in English and quarterly in French, generally 8:30 am to 3:30 pm ET. Registration requires supervisor approval through Training and Outreach (SharePoint) or Flex Training Request Form for group/custom sessions.",
  },
];

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/** Normalise a citation URL for comparison: trim, decode percent-encoding,
 *  strip trailing slashes, lowercase. */
const normalizeCitationUrl = (value?: string): string => {
  if (!value) return "";
  let normalized = value.trim();
  if (!normalized) return "";
  try {
    normalized = decodeURI(normalized);
  } catch {
    // Keep original when decode fails.
  }
  return normalized.replace(/\/+$/, "").toLowerCase();
};

/** Return true when the URL is a real HTTP(S) or path URL (not a placeholder). */
const isConcreteCitationUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().startsWith(LOCAL_CITATION_PREFIX)) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
};

/** Normalise citation body text for fuzzy-equality comparisons. */
const normalizeCitationText = (value?: string): string => {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
};

/** Return true when the citation carries non-empty body text. */
const hasCitationExcerpt = (citation: Citation): boolean =>
  typeof citation.content === "string" && citation.content.trim().length > 0;

/** Count the number of distinct concrete source URLs in a citation list. */
const countDistinctConcreteSources = (citations: Citation[] = []): number => {
  const urls = new Set(
    citations
      .filter((c) => isConcreteCitationUrl(c.url))
      .map((c) => normalizeCitationUrl(c.url))
      .filter((u) => u.length > 0),
  );
  return urls.size;
};

/** Count distinct concrete sources that also carry an excerpt. */
const countDistinctConcreteSourcesWithExcerpts = (
  citations: Citation[] = [],
): number => {
  const urls = new Set(
    citations
      .filter((c) => isConcreteCitationUrl(c.url) && hasCitationExcerpt(c))
      .map((c) => normalizeCitationUrl(c.url))
      .filter((u) => u.length > 0),
  );
  return urls.size;
};

/** Return true when two citations represent the same source. */
const citationsAreEquivalentForMerge = (
  left: Citation,
  right: Citation,
): boolean => {
  const leftUrl = normalizeCitationUrl(left.url);
  const rightUrl = normalizeCitationUrl(right.url);
  const leftTitle = left.title.trim().toLowerCase();
  const rightTitle = right.title.trim().toLowerCase();
  const leftContent = normalizeCitationText(left.content);
  const rightContent = normalizeCitationText(right.content);

  if (leftContent && rightContent) {
    if (leftTitle && rightTitle && leftTitle === rightTitle && leftContent === rightContent) return true;
    if (leftUrl && rightUrl && leftUrl === rightUrl && leftContent === rightContent) return true;
  }

  if (!leftContent && !rightContent) {
    if (leftUrl && rightUrl && leftUrl === rightUrl) return true;
    if (leftTitle && rightTitle && leftTitle === rightTitle) return true;
  }

  return false;
};

/** Return true when `candidate` is a better version of `current`. */
const isRicherCitation = (candidate: Citation, current: Citation): boolean => {
  const candidateConcrete = isConcreteCitationUrl(candidate.url);
  const currentConcrete = isConcreteCitationUrl(current.url);
  if (candidateConcrete !== currentConcrete) return candidateConcrete;

  const candidateContentLength = candidate.content?.trim().length ?? 0;
  const currentContentLength = current.content?.trim().length ?? 0;
  return candidateContentLength > currentContentLength;
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Return true when the user's prompt is likely asking about EPS. */
export const isLikelyEpsCitationQuery = (prompt: string): boolean =>
  EPS_QUERY_PATTERN.test(prompt);

/** Return true when the user's prompt is likely asking about PMCOE topics. */
export const isLikelyPmcoeCitationQuery = (prompt: string): boolean =>
  PMCOE_QUERY_PATTERN.test(prompt);

/**
 * Return true when the citation list already contains all required EPS
 * canonical source URLs.
 */
export const hasRequiredEpsLegacyCitations = (
  citations: Citation[] = [],
): boolean => {
  const existingUrls = new Set(
    citations.map((c) => normalizeCitationUrl(c.url)),
  );
  return REQUIRED_EPS_LEGACY_CITATION_URLS.every((url) =>
    existingUrls.has(normalizeCitationUrl(url)),
  );
};

/**
 * Return true when the current EPS citation coverage is insufficient and a
 * secondary MCP enrichment pass should be triggered.
 */
export const shouldEnrichEpsCitations = (
  prompt: string,
  citations: Citation[] = [],
): boolean => {
  if (!isLikelyEpsCitationQuery(prompt)) return false;

  const hasCanonicalSources = hasRequiredEpsLegacyCitations(citations);
  const concreteCount = countDistinctConcreteSources(citations);
  const concreteExcerptCount = countDistinctConcreteSourcesWithExcerpts(citations);

  return (
    !hasCanonicalSources
    || concreteCount < MIN_EPS_CONCRETE_SOURCE_COUNT
    || concreteExcerptCount < MIN_EPS_CONCRETE_SOURCE_COUNT
  );
};

/**
 * Return true when the current PMCOE citation coverage is insufficient and a
 * secondary MCP enrichment pass should be triggered.
 */
export const shouldEnrichPmcoeCitations = (
  prompt: string,
  citations: Citation[] = [],
): boolean => {
  if (!isLikelyPmcoeCitationQuery(prompt)) return false;

  const concreteCitations = citations.filter((c) => isConcreteCitationUrl(c.url));
  const hasConcreteExcerpts = concreteCitations.some(hasCitationExcerpt);
  const distinctConcreteCount = countDistinctConcreteSources(citations);
  const hasSyntheticLocal = citations.some((c) =>
    c.url.toLowerCase().startsWith(LOCAL_CITATION_PREFIX),
  );

  return (
    hasSyntheticLocal
    || concreteCitations.length < MIN_PMCOE_CONCRETE_SOURCE_COUNT
    || distinctConcreteCount < MIN_PMCOE_CONCRETE_SOURCE_COUNT
    || !hasConcreteExcerpts
  );
};

/**
 * If any concrete (non-local) citations exist, discard all synthetic
 * placeholder citations. This prevents local-citation:// entries from
 * polluting the final citation list after a successful enrichment pass.
 */
export const stripSyntheticCitationsWhenConcreteExists = (
  citations: Citation[] = [],
): Citation[] => {
  const concrete = citations.filter((c) => isConcreteCitationUrl(c.url));
  return concrete.length === 0 ? citations : concrete;
};

/**
 * Merge two citation arrays, preferring concrete URLs and richer content.
 *
 * `primary` entries are kept as-is. `fallback` entries are appended unless
 * an equivalent entry already exists, in which case the richer version wins.
 *
 * Distinct excerpts from the same document are intentionally preserved to
 * avoid over-fitting the grounded rewrite to a single source.
 */
export const mergeCitationsPreferConcreteUrls = (
  primary: Citation[] = [],
  fallback: Citation[] = [],
): Citation[] => {
  const merged: Citation[] = [...primary];

  for (const citation of fallback) {
    const existingIndex = merged.findIndex((current) =>
      citationsAreEquivalentForMerge(current, citation),
    );
    if (existingIndex < 0) {
      merged.push(citation);
    } else if (isRicherCitation(citation, merged[existingIndex])) {
      merged[existingIndex] = citation;
    }
  }

  return merged;
};

/**
 * Return only the required EPS canonical citations from the list, or an empty
 * array if any are missing.
 */
export const selectCanonicalEpsCitations = (
  citations: Citation[] = [],
): Citation[] => {
  const byUrl = new Map<string, Citation>();
  for (const citation of citations) {
    byUrl.set(normalizeCitationUrl(citation.url), citation);
  }

  const required = REQUIRED_EPS_LEGACY_CITATION_URLS
    .map((url) => byUrl.get(normalizeCitationUrl(url)))
    .filter((c): c is Citation => Boolean(c));

  return required.length === REQUIRED_EPS_LEGACY_CITATION_URLS.length
    ? required
    : [];
};
