/**
 * Citation domain helpers.
 *
 * Provides detection/enrichment guards, merge strategies, canonical fallback
 * sources, and text cleanup used by the assistant citation pipeline.
 */
import { Citation } from "../../utils/citations";

const TOOL_CALL_STATUS_PATTERN = /\n[^\n]* is being called\.\.\.\n/g;
const LOCAL_CITATION_PREFIX = "local-citation://";
const EPS_QUERY_PATTERN = /\b(enterprise\s+(project|portfolio)\s+system|eps)\b/i;
const PMCOE_QUERY_PATTERN = /\b(pmcoe|project management|operating guide|gate review|through the gates?|opmca)\b/i;
const MIN_EPS_CONCRETE_SOURCE_COUNT = 3;
const MIN_PMCOE_CONCRETE_SOURCE_COUNT = 2;
const REQUIRED_EPS_LEGACY_CITATION_URLS = [
  "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system",
  "https://plus.ssc-spc.gc.ca/en/page/enterprise-portfolio-system-training",
] as const;

export const MAX_GROUNDED_REWRITE_EXCERPT_CHARS = 700;

/**
 * Static EPS fallback citations are used only when enrichment cannot recover
 * enough authoritative concrete sources. Keep this synchronized with the
 * approved source-of-truth content pipeline.
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

export const MCP_CITATION_HARVEST_SYSTEM_PROMPT = [
  "You are gathering authoritative source material for a user request.",
  "Use the available MCP tools to retrieve the most relevant official sources, excerpts, and citations.",
  "Review all relevant sources returned by the MCP server before responding.",
  "Prioritize source quality over prose quality.",
  "Keep the answer brief and grounded in the retrieved material.",
].join(" ");

export const MCP_GROUNDED_REWRITE_SYSTEM_PROMPT = [
  "You are revising an assistant answer using cited source excerpts returned from MCP tools.",
  "Rewrite the answer so every factual claim is supported by the provided source material.",
  "Use all provided source excerpts, not just the first matching source.",
  "When multiple sources add relevant details, synthesize them together in the final answer.",
  "If a source explicitly defines an acronym, official name, or term, use that exact source wording even when the user's question or the draft answer used a different term.",
  "Keep the answer concise, preserve the draft language, remove unsupported claims, and do not mention this rewrite instruction.",
  "Do not invent citation markers or new sources.",
].join(" ");

const normalizeCitationUrl = (value?: string): string => {
  if (!value) return "";
  let normalized = value.trim();
  if (!normalized) return "";

  try {
    normalized = decodeURI(normalized);
  } catch {
    // Keep original value when decode fails.
  }

  return normalized.replace(/\/+$/, "").toLowerCase();
};

const isConcreteCitationUrl = (url?: string): boolean => {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  if (trimmed.toLowerCase().startsWith(LOCAL_CITATION_PREFIX)) return false;
  return /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
};

const normalizeCitationText = (value?: string): string => {
  if (!value) return "";
  return value.trim().replace(/\s+/g, " ").toLowerCase();
};

const hasCitationExcerpt = (citation: Citation): boolean => {
  return typeof citation.content === "string" && citation.content.trim().length > 0;
};

const countDistinctConcreteSources = (citations: Citation[] = []): number => {
  const urls = new Set(
    citations
      .filter((citation) => isConcreteCitationUrl(citation.url))
      .map((citation) => normalizeCitationUrl(citation.url))
      .filter((url) => url.length > 0),
  );

  return urls.size;
};

const countDistinctConcreteSourcesWithExcerpts = (citations: Citation[] = []): number => {
  const urls = new Set(
    citations
      .filter((citation) => isConcreteCitationUrl(citation.url) && hasCitationExcerpt(citation))
      .map((citation) => normalizeCitationUrl(citation.url))
      .filter((url) => url.length > 0),
  );

  return urls.size;
};

export const stripSyntheticCitationsWhenConcreteExists = (citations: Citation[] = []): Citation[] => {
  const concrete = citations.filter((citation) => isConcreteCitationUrl(citation.url));
  if (concrete.length === 0) {
    return citations;
  }
  return concrete;
};

const citationsAreEquivalentForMerge = (left: Citation, right: Citation): boolean => {
  const leftUrl = normalizeCitationUrl(left.url);
  const rightUrl = normalizeCitationUrl(right.url);
  const leftTitle = left.title.trim().toLowerCase();
  const rightTitle = right.title.trim().toLowerCase();
  const leftContent = normalizeCitationText(left.content);
  const rightContent = normalizeCitationText(right.content);

  if (leftContent && rightContent) {
    if (leftTitle && rightTitle && leftTitle === rightTitle && leftContent === rightContent) {
      return true;
    }

    if (leftUrl && rightUrl && leftUrl === rightUrl && leftContent === rightContent) {
      return true;
    }
  }

  if (!leftContent && !rightContent) {
    if (leftUrl && rightUrl && leftUrl === rightUrl) {
      return true;
    }

    if (leftTitle && rightTitle && leftTitle === rightTitle) {
      return true;
    }
  }

  return false;
};

const isRicherCitation = (candidate: Citation, current: Citation): boolean => {
  const candidateConcrete = isConcreteCitationUrl(candidate.url);
  const currentConcrete = isConcreteCitationUrl(current.url);
  if (candidateConcrete !== currentConcrete) {
    return candidateConcrete;
  }

  const candidateContentLength = candidate.content?.trim().length ?? 0;
  const currentContentLength = current.content?.trim().length ?? 0;
  if (candidateContentLength !== currentContentLength) {
    return candidateContentLength > currentContentLength;
  }

  return false;
};

export const selectCanonicalEpsCitations = (citations: Citation[] = []): Citation[] => {
  const byUrl = new Map<string, Citation>();
  for (const citation of citations) {
    byUrl.set(normalizeCitationUrl(citation.url), citation);
  }

  const required = REQUIRED_EPS_LEGACY_CITATION_URLS
    .map((url) => byUrl.get(normalizeCitationUrl(url)))
    .filter((citation): citation is Citation => Boolean(citation));

  if (required.length !== REQUIRED_EPS_LEGACY_CITATION_URLS.length) {
    return [];
  }

  return required;
};

export const mergeCitationsPreferConcreteUrls = (
  primary: Citation[] = [],
  fallback: Citation[] = [],
): Citation[] => {
  // Merge order preserves primary ranking while allowing richer fallback replacements.
  const merged: Citation[] = [];

  for (const citation of primary) {
    merged.push(citation);
  }

  for (const citation of fallback) {
    const existingIndex = merged.findIndex((current) => citationsAreEquivalentForMerge(current, citation));
    if (existingIndex < 0) {
      merged.push(citation);
      continue;
    }

    const current = merged[existingIndex];
    if (isRicherCitation(citation, current)) {
      merged[existingIndex] = citation;
    }
  }

  return merged;
};

export const isLikelyEpsCitationQuery = (prompt: string): boolean => {
  return EPS_QUERY_PATTERN.test(prompt);
};

export const isLikelyPmcoeCitationQuery = (prompt: string): boolean => {
  return PMCOE_QUERY_PATTERN.test(prompt);
};

export const hasRequiredEpsLegacyCitations = (citations: Citation[] = []): boolean => {
  const existingUrls = new Set(citations.map((citation) => normalizeCitationUrl(citation.url)));
  return REQUIRED_EPS_LEGACY_CITATION_URLS.every((requiredUrl) => {
    return existingUrls.has(normalizeCitationUrl(requiredUrl));
  });
};

export const shouldEnrichEpsCitations = (prompt: string, citations: Citation[] = []): boolean => {
  // EPS enrichment is only relevant for EPS-like prompts.
  if (!isLikelyEpsCitationQuery(prompt)) {
    return false;
  }

  const hasCanonicalEpsSources = hasRequiredEpsLegacyCitations(citations);
  const distinctConcreteSourceCount = countDistinctConcreteSources(citations);
  const distinctConcreteExcerptSourceCount = countDistinctConcreteSourcesWithExcerpts(citations);

  return !hasCanonicalEpsSources
    || distinctConcreteSourceCount < MIN_EPS_CONCRETE_SOURCE_COUNT
    || distinctConcreteExcerptSourceCount < MIN_EPS_CONCRETE_SOURCE_COUNT;
};

export const shouldEnrichPmcoeCitations = (prompt: string, citations: Citation[] = []): boolean => {
  // PMCOE enrichment is only relevant for PMCOE-like prompts.
  if (!isLikelyPmcoeCitationQuery(prompt)) {
    return false;
  }

  const concreteCitations = citations.filter((citation) => isConcreteCitationUrl(citation.url));
  const concreteCitationCount = concreteCitations.length;
  const hasConcreteExcerpts = concreteCitations.some((citation) => hasCitationExcerpt(citation));
  const distinctConcreteSourceCount = countDistinctConcreteSources(citations);
  const hasSyntheticLocalCitation = citations.some((citation) =>
    citation.url.toLowerCase().startsWith(LOCAL_CITATION_PREFIX)
  );

  return hasSyntheticLocalCitation
    || concreteCitationCount < MIN_PMCOE_CONCRETE_SOURCE_COUNT
    || distinctConcreteSourceCount < MIN_PMCOE_CONCRETE_SOURCE_COUNT
    || !hasConcreteExcerpts;
};

export const deriveSessionName = (content: string): string => {
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(" ").slice(0, 30);
};

export const stripToolCallStatusMessages = (content: string): string =>
  content.replace(TOOL_CALL_STATUS_PATTERN, "\n").replace(/\n{3,}/g, "\n\n").trim();
