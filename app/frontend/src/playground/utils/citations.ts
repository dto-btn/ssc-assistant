/**
 * Citation utilities for Playground responses.
 *
 * The provider can emit citations through multiple shapes: legacy [docN]
 * markers, Responses API annotations, and ad-hoc MCP payload objects. These
 * helpers normalize those variants into one renderable model for inline links
 * and the citation drawer.
 */
export interface Citation {
  title: string;
  url: string;
  content?: string;
  startIndex?: number;
  endIndex?: number;
}

export interface GroupedCitation {
  url: string;
  title: string;
  citations: Citation[];
  displayNumber: number;
}

export interface ProcessedCitationsResult {
  processedText: string;
  citedCitations: Citation[];
  citationNumberMapping: Record<number, number>;
}

const DOC_REFERENCE_REGEX = /\[doc(\d+)\]/g;
const DOC_REFERENCE_TEST_REGEX = /\[doc(\d+)\]/;
<<<<<<< HEAD
const EXPLICIT_CITATION_LINK_REGEX = /\[(\d+)\]\((<[^>\n]+>|[^)\s]+)\)/g;
const LOCAL_CITATION_PREFIX = "local-citation://";
const DEFAULT_PMCOE_CONTAINER = String(import.meta.env.VITE_PMCOE_CONTAINER || "pmcoe-sept-2025").trim() || "pmcoe-sept-2025";
const PMCOE_FILE_EXTENSION_PATTERN = /\.(pdf|docx?|pptx?|xlsx?|txt|md)$/i;
const PMCOE_HINT_PATTERN = /\b(pmcoe|pmli|project manager-led initiatives?|project management|operating guide|gate(?: review| governance)?|opmca|pgof|pcra|task financial authorization|execution stage|realization plan|enterprise portfolio system|eps)\b/i;
=======
const LOCAL_CITATION_PREFIX = "local-citation://";
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)

type IndexedCitation = {
  citation: Citation;
  citationIndex: number;
};
<<<<<<< HEAD

type ExplicitCitationLink = {
  displayNumber: number;
  url: string;
};

/**
 * Provider-specific extraction hints used while normalizing citation payloads.
 */
type CitationExtractionOptions = {
  enablePmcoePathInference?: boolean;
  pmcoeContainer?: string;
  preferredLanguage?: "en" | "fr";
};
=======
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)

const isFiniteNumber = (value: unknown): value is number => {
  return typeof value === "number" && Number.isFinite(value);
};

const toNonEmptyString = (value: unknown): string | undefined => {
  return typeof value === "string" && value.trim().length > 0
    ? value
    : undefined;
};

const toStringFromKeys = (
  record: Record<string, unknown>,
  keys: string[],
): string | undefined => {
  for (const key of keys) {
    const value = toNonEmptyString(record[key]);
    if (value) {
      return value;
    }
  }
  return undefined;
};

const looksLikeUrlOrPath = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return (
    /^https?:\/\//i.test(trimmed)
    || trimmed.startsWith("/")
    || /\.(pdf|docx?|pptx?|xlsx?|txt|md)([#?].*)?$/i.test(trimmed)
    || /[\\/]/.test(trimmed)
  );
};

const tryParseFiniteNumber = (value: unknown): number | undefined => {
  if (isFiniteNumber(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return undefined;
};

const normalizeCitationUrl = (rawUrl: string): string => {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return "";
  }

  if (
    /^https?:\/\//i.test(trimmed)
    || trimmed.startsWith("/")
    || /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
  ) {
    return trimmed;
  }

  return `/${trimmed.replace(/^\/+/, "")}`;
};

const inferPmcoeLanguage = (value: string, preferredLanguage?: "en" | "fr"): "en" | "fr" => {
  if (/(^|[\s._-])(fr|fra|french|francais|français)([\s._-]|$)/i.test(value)) {
    return "fr";
  }

  if (/(^|[\s._-])(en|eng|english)([\s._-]|$)/i.test(value)) {
    return "en";
  }

  return preferredLanguage === "fr" ? "fr" : "en";
};

const inferPmcoeCitationUrl = (
  record: Record<string, unknown>,
  title: string | undefined,
  content: string | undefined,
  options: CitationExtractionOptions,
): string | undefined => {
  if (!options.enablePmcoePathInference) {
    return undefined;
  }

  const fileName = toStringFromKeys(record, [
    "file_name",
    "fileName",
    "filename",
    "document_title",
    "documentTitle",
    "title",
    "name",
  ]);

  if (!fileName || !PMCOE_FILE_EXTENSION_PATTERN.test(fileName)) {
    return undefined;
  }

  const hintText = [
    fileName,
    title,
    content,
    toStringFromKeys(record, ["tool_name", "toolName", "index_name", "indexName", "collection"]),
  ]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(" ");

  if (!PMCOE_HINT_PATTERN.test(hintText)) {
    return undefined;
  }

  const langHint = [
    toStringFromKeys(record, ["lang", "language", "locale", "document_language", "documentLanguage"]),
    fileName,
  ]
    .filter((value): value is string => Boolean(value && value.trim().length > 0))
    .join(" ");

  const pmcoeContainer = (options.pmcoeContainer || DEFAULT_PMCOE_CONTAINER).trim() || DEFAULT_PMCOE_CONTAINER;
  const language = inferPmcoeLanguage(langHint, options.preferredLanguage);
  return normalizeCitationUrl(`/${pmcoeContainer}/${language}/${fileName.replace(/^\/+/, "")}`);
};

// Providers and MCP tools use different source field names; collapse them
// into one normalized URL/path so downstream rendering stays provider-agnostic.
const resolveCitationUrl = (record: Record<string, unknown>): string | undefined => {
  const strictCandidate = toStringFromKeys(record, [
    "url",
    "source_url",
    "sourceUrl",
    "link",
    "filepath",
    "file_path",
    "source_path",
    "sourcePath",
    "path",
    "document_url",
    "documentUrl",
    "file_url",
    "fileUrl",
  ]);

  const looseCandidate = toStringFromKeys(record, ["source", "document", "uri", "file"]);
  const candidate = strictCandidate || (looseCandidate && looksLikeUrlOrPath(looseCandidate) ? looseCandidate : undefined);

  if (!candidate) {
    return undefined;
  }

  return normalizeCitationUrl(candidate);
};

const getRecord = (value: unknown): Record<string, unknown> | undefined => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
};

<<<<<<< HEAD
// Synthetic local references can still appear in historical payloads or tests,
// but they are not actionable enough to show as end-user citations.
=======
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
const isDisplayableCitationUrl = (url: string | undefined): boolean => {
  if (!url) {
    return false;
  }

  const trimmed = url.trim();
  if (!trimmed) {
    return false;
  }

  return !trimmed.toLowerCase().startsWith(LOCAL_CITATION_PREFIX);
};

const getRenderableCitationEntries = (citations: Citation[]): IndexedCitation[] => {
  return citations
    .map((citation, index) => ({ citation, citationIndex: index + 1 }))
    .filter(({ citation }) => isDisplayableCitationUrl(citation.url));
};

<<<<<<< HEAD
/**
 * Attempt to build one citation from an arbitrary record discovered while
 * walking streamed events or nested MCP payloads.
 */
=======
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
const buildCitationFromRecord = (
  record: Record<string, unknown>,
  inCitationContext: boolean,
  options: CitationExtractionOptions,
): Citation | undefined => {
  const type = toNonEmptyString(record.type)?.toLowerCase();

  const title = toStringFromKeys(record, [
    "title",
    "source_title",
    "sourceTitle",
    "document_title",
    "documentTitle",
    "file_name",
    "fileName",
    "filename",
    "name",
  ]);

  const baseContent = toStringFromKeys(record, [
    "text",
    "content",
    "excerpt",
    "chunk",
    "snippet",
    "passage",
    "quote",
    "article",
    "section_text",
    "sectionText",
    "source_text",
    "sourceText",
    "document_content",
    "documentContent",
    "raw_content",
    "rawContent",
    "body",
    "page_content",
    "pageContent",
  ]);

  const pageNumber =
    tryParseFiniteNumber(record.page_number)
    ?? tryParseFiniteNumber(record.pageNumber)
    ?? tryParseFiniteNumber(record.page);

  const content = baseContent
    ? (pageNumber && !/\bpage\s+\d+\b/i.test(baseContent)
      ? `Page ${pageNumber}\n${baseContent}`
      : baseContent)
    : undefined;

  const resolvedUrl = resolveCitationUrl(record) || inferPmcoeCitationUrl(record, title, content, options);

  const isTypedCitation = type === "url_citation" || type === "citation";
  const isCitationLike = isTypedCitation || inCitationContext || Boolean(title) || Boolean(content) || Boolean(resolvedUrl);
  if (!isCitationLike) {
    return undefined;
  }

<<<<<<< HEAD
  // Do not invent placeholder URLs here. Missing source paths create noisy
  // "citations" that the UI cannot open or explain meaningfully.
=======
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
  if (!resolvedUrl) {
    return undefined;
  }

  const normalizedTitle = (title || "").trim().toLowerCase();
  const normalizedContent = (content || "").trim().toLowerCase();
  const looksLikeFile = Boolean(title && /(\.pdf$|\.docx?$|\.pptx?$|-pdf$|guide|manual|policy|framework|operating|process|standard)/i.test(title));
  const hasMeaningfulExcerpt = Boolean(content && content.trim().length >= 35);
  const isMetadataNoiseTitle = /^(query|doc[\s_]?id|id|score|metadata|filter|filters|source id)$/i.test(normalizedTitle);
  const isMetadataNoiseContent = /^(query|doc[\s_]?id|id|score|metadata)$/i.test(normalizedContent);

  if (isMetadataNoiseTitle && !hasMeaningfulExcerpt) {
    return undefined;
  }
  if (isMetadataNoiseContent && !looksLikeFile) {
    return undefined;
  }

  const startIndex =
    tryParseFiniteNumber(record.start_index)
    ?? tryParseFiniteNumber(record.startIndex)
    ?? tryParseFiniteNumber(record.char_start)
    ?? tryParseFiniteNumber(record.charStart)
    ?? tryParseFiniteNumber(record.offset_start)
    ?? tryParseFiniteNumber(record.offsetStart);
  const endIndex =
    tryParseFiniteNumber(record.end_index)
    ?? tryParseFiniteNumber(record.endIndex)
    ?? tryParseFiniteNumber(record.char_end)
    ?? tryParseFiniteNumber(record.charEnd)
    ?? tryParseFiniteNumber(record.offset_end)
    ?? tryParseFiniteNumber(record.offsetEnd);

  return {
    title: title || resolvedUrl,
    url: resolvedUrl,
    content,
    startIndex,
    endIndex,
  };
};

/**
 * When providers omit annotation offsets, approximate the citation anchor from
 * the excerpt/title so inline numbering lands near the referenced sentence.
 */
const inferCitationEndIndex = (text: string, citation: Citation): number | undefined => {
  if (isFiniteNumber(citation.endIndex)) {
    return citation.endIndex;
  }

  const textLower = text.toLowerCase();
  const candidates: string[] = [];

  if (citation.content) {
    const compact = citation.content.replace(/\s+/g, " ").trim();
    if (compact.length > 0) {
      candidates.push(compact);
      const firstSentence = compact.split(/[.!?]/)[0]?.trim();
      if (firstSentence && firstSentence.length >= 16) {
        candidates.push(firstSentence);
      }
      const firstWords = compact.split(/\s+/).slice(0, 10).join(" ").trim();
      if (firstWords.length >= 16) {
        candidates.push(firstWords);
      }
    }
  }

  if (citation.title) {
    const titleCandidate = citation.title.replace(/[-_]+/g, " ").trim();
    if (titleCandidate.length >= 10) {
      candidates.push(titleCandidate);
    }
  }

  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = candidate.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);

    const idx = textLower.indexOf(key);
    if (idx >= 0) {
      return idx + candidate.length;
    }
  }

  return undefined;
};

const collectSentenceEndPositions = (text: string): number[] => {
  const positions: number[] = [];
  const regex = /[.!?]+\s*/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    positions.push(match.index + match[0].length);
  }
  return positions;
};

<<<<<<< HEAD
type ProtectedMarkdownRange = {
  start: number;
  end: number;
  insertionIndex: number;
};

const BARE_URL_REGEX = /\b(?:https?:\/\/|mailto:)[^\s<]+/gi;

const isEscapedCharacter = (text: string, index: number): boolean => {
  let backslashCount = 0;

  for (let cursor = index - 1; cursor >= 0 && text[cursor] === "\\"; cursor -= 1) {
    backslashCount += 1;
  }

  return backslashCount % 2 === 1;
};

const findMatchingDelimiter = (
  text: string,
  startIndex: number,
  openChar: string,
  closeChar: string,
): number | undefined => {
  let depth = 0;

  for (let index = startIndex; index < text.length; index += 1) {
    const char = text[index];
    if (char === openChar && !isEscapedCharacter(text, index)) {
      depth += 1;
      continue;
    }

    if (char === closeChar && !isEscapedCharacter(text, index)) {
      depth -= 1;
      if (depth === 0) {
        return index;
      }
    }
  }

  return undefined;
};

const countOccurrences = (value: string, target: string): number => {
  let count = 0;
  for (const char of value) {
    if (char === target) {
      count += 1;
    }
  }
  return count;
};

const trimTrailingBareUrlPunctuation = (value: string): string => {
  let trimmed = value.replace(/[.,;:!?]+$/g, "");

  const pairedDelimiters: Array<[string, string]> = [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ];

  let updated = true;
  while (updated && trimmed.length > 0) {
    updated = false;

    for (const [openChar, closeChar] of pairedDelimiters) {
      if (!trimmed.endsWith(closeChar)) {
        continue;
      }

      const openCount = countOccurrences(trimmed, openChar);
      const closeCount = countOccurrences(trimmed, closeChar);
      if (closeCount > openCount) {
        trimmed = trimmed.slice(0, -1);
        updated = true;
      }
    }
  }

  return trimmed;
};

const overlapsProtectedRange = (
  start: number,
  end: number,
  protectedRanges: ProtectedMarkdownRange[],
): boolean => {
  return protectedRanges.some((range) => start < range.end && end > range.start);
};

const collectProtectedMarkdownRanges = (text: string): ProtectedMarkdownRange[] => {
  const ranges: ProtectedMarkdownRange[] = [];

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];

    if (char === "<" && !isEscapedCharacter(text, index)) {
      const closeIndex = text.indexOf(">", index + 1);
      if (closeIndex > index + 1) {
        const candidate = text.slice(index + 1, closeIndex).trim();
        if (/^(https?:\/\/|mailto:)/i.test(candidate)) {
          ranges.push({
            start: index,
            end: closeIndex + 1,
            insertionIndex: closeIndex + 1,
          });
          index = closeIndex;
        }
      }
      continue;
    }

    if (char !== "[" || isEscapedCharacter(text, index)) {
      continue;
    }

    const rangeStart = index > 0 && text[index - 1] === "!" && !isEscapedCharacter(text, index - 1)
      ? index - 1
      : index;
    const labelEnd = findMatchingDelimiter(text, index, "[", "]");
    if (labelEnd === undefined) {
      continue;
    }

    const nextChar = text[labelEnd + 1];
    if (nextChar === "(") {
      const destinationEnd = findMatchingDelimiter(text, labelEnd + 1, "(", ")");
      if (destinationEnd !== undefined) {
        ranges.push({
          start: rangeStart,
          end: destinationEnd + 1,
          insertionIndex: destinationEnd + 1,
        });
        index = destinationEnd;
      }
      continue;
    }

    if (nextChar === "[") {
      const referenceEnd = findMatchingDelimiter(text, labelEnd + 1, "[", "]");
      if (referenceEnd !== undefined) {
        ranges.push({
          start: rangeStart,
          end: referenceEnd + 1,
          insertionIndex: referenceEnd + 1,
        });
        index = referenceEnd;
      }
    }
  }

  BARE_URL_REGEX.lastIndex = 0;
  let bareUrlMatch: RegExpExecArray | null;
  while ((bareUrlMatch = BARE_URL_REGEX.exec(text)) !== null) {
    const rawUrl = bareUrlMatch[0];
    const trimmedUrl = trimTrailingBareUrlPunctuation(rawUrl);
    if (!trimmedUrl) {
      continue;
    }

    const start = bareUrlMatch.index;
    const end = start + trimmedUrl.length;
    if (overlapsProtectedRange(start, end, ranges)) {
      continue;
    }

    ranges.push({
      start,
      end,
      insertionIndex: end,
    });
  }

  return ranges.sort((a, b) => a.start - b.start);
};

const resolveSafeInsertionIndex = (
  offset: number,
  protectedRanges: ProtectedMarkdownRange[],
): number => {
  for (const range of protectedRanges) {
    if (offset > range.start && offset < range.end) {
      return range.insertionIndex;
    }
  }

  return offset;
};

const cleanupCitationSpacing = (text: string): string => {
  return text
    .replace(/\s+([,.;!?])/g, "$1")
    .replace(/ {2,}/g, " ");
};

const normalizeExplicitCitationHref = (rawHref: string): string => {
  const trimmed = rawHref.trim();
  if (!trimmed) {
    return "";
  }

  if (trimmed.startsWith("<") && trimmed.endsWith(">")) {
    return trimmed.slice(1, -1);
  }

  return trimmed;
};

const extractExplicitCitationLinks = (text: string): ExplicitCitationLink[] => {
  const links: ExplicitCitationLink[] = [];
  let match: RegExpExecArray | null;

  EXPLICIT_CITATION_LINK_REGEX.lastIndex = 0;
  while ((match = EXPLICIT_CITATION_LINK_REGEX.exec(text)) !== null) {
    const displayNumber = Number.parseInt(match[1], 10);
    if (!Number.isFinite(displayNumber)) {
      continue;
    }

    const normalizedUrl = normalizeExplicitCitationHref(match[2]);
    if (!normalizedUrl) {
      continue;
    }

    links.push({
      displayNumber,
      url: normalizedUrl,
    });
  }

  return links;
};

const urlsMatch = (left: string, right: string): boolean => {
  const normalizedLeft = safeDecodeUri(left).trim();
  const normalizedRight = safeDecodeUri(right).trim();

  if (!normalizedLeft || !normalizedRight) {
    return false;
  }

  return normalizedLeft === normalizedRight;
};

const processExplicitCitationLinks = (
  text: string,
  citations: Citation[],
): ProcessedCitationsResult | undefined => {
  const explicitLinks = extractExplicitCitationLinks(text);
  if (!explicitLinks.length) {
    return undefined;
  }

  const renderableEntries = getRenderableCitationEntries(citations);
  if (!renderableEntries.length) {
    return {
      processedText: text,
      citedCitations: [],
      citationNumberMapping: {},
    };
  }

  const remainingLinks = [...explicitLinks];
  const citationNumberMapping: Record<number, number> = {};
  const citedCitations: Citation[] = [];

  renderableEntries.forEach(({ citation, citationIndex }) => {
    const matchingLinkIndex = remainingLinks.findIndex((link) =>
      urlsMatch(link.url, citation.url),
    );
    const fallbackIndex = remainingLinks.findIndex(() => true);
    const resolvedIndex = matchingLinkIndex >= 0 ? matchingLinkIndex : fallbackIndex;

    if (resolvedIndex < 0) {
      return;
    }

    const [matchedLink] = remainingLinks.splice(resolvedIndex, 1);
    citationNumberMapping[citationIndex] = matchedLink.displayNumber;
    citedCitations.push(citation);
  });

  return {
    processedText: text,
    citedCitations,
    citationNumberMapping,
  };
};

// If we cannot place citations by offset, fall back to sentence boundaries so
// the answer still carries ordered citations instead of losing them entirely.
const insertMarkersBySentence = (
  text: string,
  citationEntries: IndexedCitation[],
=======
  const cleanupCitationSpacing = (text: string): string => {
    return text
      .replace(/\s+([,.;!?])/g, "$1")
      .replace(/ {2,}/g, " ");
  };

const insertMarkersBySentence = (
  text: string,
    citationEntries: IndexedCitation[],
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
  citationNumberMapping: Record<number, number>,
): string => {
  const sentenceEnds = collectSentenceEndPositions(text);
  let processedText = text;
  let offset = 0;

<<<<<<< HEAD
  citationEntries.forEach(({ citation, citationIndex }, idx) => {
=======
    citationEntries.forEach(({ citation, citationIndex }, idx) => {
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
    const displayNumber = citationNumberMapping[citationIndex];
    if (!displayNumber) {
      return;
    }

    const basePosition = sentenceEnds[idx] ?? text.length;
    const insertAt = Math.min(processedText.length, Math.max(0, basePosition + offset));
    const previousChar = insertAt > 0 ? processedText[insertAt - 1] : "";
    const nextChar = insertAt < processedText.length ? processedText[insertAt] : "";
    const leadingSpace = previousChar && /\s/.test(previousChar) ? "" : " ";
    const trailingSpace = nextChar && !/\s/.test(nextChar) ? " " : "";
    const marker = `${leadingSpace}[${displayNumber}](<${encodeURI(citation.url)}>)${trailingSpace}`;

    processedText = `${processedText.slice(0, insertAt)}${marker}${processedText.slice(insertAt)}`;
    offset += marker.length;
  });

  return processedText;
};

const citationKey = (citation: Citation): string => {
  return [
    citation.url,
    citation.title,
    citation.content || "",
    citation.startIndex ?? "",
    citation.endIndex ?? "",
  ].join("|");
};

/**
 * Merge citation lists, deduplicate semantically identical entries, and keep a
 * stable order for rendering and grouping.
 */
export const mergeCitations = (base: Citation[], incoming: Citation[]): Citation[] => {
  const merged = new Map<string, Citation>();

  [...base, ...incoming].forEach((citation) => {
    merged.set(citationKey(citation), citation);
  });

  return Array.from(merged.values()).sort((a, b) => {
    const aStart = a.startIndex ?? Number.MAX_SAFE_INTEGER;
    const bStart = b.startIndex ?? Number.MAX_SAFE_INTEGER;
    if (aStart !== bStart) {
      return aStart - bStart;
    }

    const aEnd = a.endIndex ?? Number.MAX_SAFE_INTEGER;
    const bEnd = b.endIndex ?? Number.MAX_SAFE_INTEGER;
    if (aEnd !== bEnd) {
      return aEnd - bEnd;
    }

    return a.url.localeCompare(b.url);
  });
};

const parseJsonIfPossible = (value: string): unknown | undefined => {
  const trimmed = value.trim();
  if (!trimmed || (trimmed[0] !== "{" && trimmed[0] !== "[")) {
    return undefined;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return undefined;
  }
};

/**
 * Walk an arbitrary payload and recover any citation-like objects nested in
 * events, tool responses, or JSON-string fields.
 */
export const extractCitationsFromPayload = (payload: unknown): Citation[] => {
  return extractCitationsFromPayloadWithOptions(payload, {});
};

/**
 * Walk arbitrary event or tool payloads with optional provider hints such as
 * PMCOE filename-to-path inference.
 */
export const extractCitationsFromPayloadWithOptions = (
  payload: unknown,
  options: CitationExtractionOptions,
): Citation[] => {
  const found: Citation[] = [];
  const visited = new WeakSet<object>();

  const walk = (value: unknown, inCitationContext = false): void => {
    const parsedObject = getRecord(value);
    if (parsedObject) {
      if (visited.has(parsedObject)) {
        return;
      }
      visited.add(parsedObject);

      const citation = buildCitationFromRecord(parsedObject, inCitationContext, options);
      if (citation) {
        found.push(citation);
      }

      Object.entries(parsedObject).forEach(([key, child]) => {
        const childContext = inCitationContext || key.toLowerCase().includes("citation");
        if (typeof child === "string") {
          // Providers and MCP tools sometimes JSON-stringify nested objects,
          // so parse those before recursing deeper.
          const parsed = parseJsonIfPossible(child);
          if (parsed !== undefined) {
            walk(parsed, childContext);
            return;
          }
        }

        walk(child, childContext);
      });
      return;
    }

    if (Array.isArray(value)) {
      value.forEach((item) => walk(item, inCitationContext));
      return;
    }

    if (typeof value === "string") {
      const parsed = parseJsonIfPossible(value);
      if (parsed !== undefined) {
        walk(parsed, inCitationContext);
      }
    }
  };

  walk(payload);
  return mergeCitations([], found);
};

/**
 * Decode URLs for comparison and display without throwing on partially encoded values.
 */
export const safeDecodeUri = (url: string): string => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

/**
 * Build the display-number mapping for legacy `[docN]` references while
 * skipping citations that should not be rendered to the end user.
 */
const buildDocMarkerCitationMap = (
  text: string,
  citations: Citation[],
): { citationNumberMapping: Record<number, number>; citedCitations: Citation[] } => {
  const citationNumberMapping: Record<number, number> = {};

  citations.forEach((citation, index) => {
    const docNumber = index + 1;
    if (isDisplayableCitationUrl(citation.url) && text.includes(`[doc${docNumber}]`)) {
      citationNumberMapping[docNumber] = Object.keys(citationNumberMapping).length + 1;
    }
  });

  const citedCitations = citations.filter((citation, index) => {
    const docNumber = index + 1;
    return isDisplayableCitationUrl(citation.url) && citationNumberMapping[docNumber] !== undefined;
  });

  return { citationNumberMapping, citedCitations };
};

const replaceDocReferences = (
  text: string,
  citations: Citation[],
  citationNumberMapping: Record<number, number>,
): string => {
  const replaced = text.replace(DOC_REFERENCE_REGEX, (_, docNumberText) => {
    const docNumber = Number.parseInt(String(docNumberText), 10);
    const citation = citations[docNumber - 1];
    if (!citation?.url) {
      return "";
    }
    const mappedNumber = citationNumberMapping[docNumber];
    if (!mappedNumber) {
      return "";
    }

    const encodedUrl = encodeURI(citation.url);
    return ` [${mappedNumber}](<${encodedUrl}>)`;
  });

  return cleanupCitationSpacing(replaced);
};

const processAnnotationReferences = (
  text: string,
  citations: Citation[],
): ProcessedCitationsResult => {
  const renderableEntries = getRenderableCitationEntries(citations);
  if (!renderableEntries.length) {
    return {
      processedText: text,
      citedCitations: [],
      citationNumberMapping: {},
    };
  }

  const citationNumberMapping: Record<number, number> = {};
<<<<<<< HEAD
  // Keep display numbers keyed to the original citation index so grouped
  // sources and [docN] references stay stable even after filtering locals.
=======
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
  renderableEntries.forEach(({ citationIndex }, index) => {
    citationNumberMapping[citationIndex] = index + 1;
  });

<<<<<<< HEAD
  const protectedRanges = collectProtectedMarkdownRanges(text);

=======
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
  const annotations = renderableEntries
    .map(({ citation, citationIndex }) => ({
      citation,
      citationIndex,
<<<<<<< HEAD
      endIndex: (() => {
        const inferredEndIndex = inferCitationEndIndex(text, citation);
        if (!isFiniteNumber(inferredEndIndex)) {
          return undefined;
        }

        return resolveSafeInsertionIndex(inferredEndIndex, protectedRanges);
      })(),
=======
      endIndex: inferCitationEndIndex(text, citation),
>>>>>>> d689cab (feat: enhance citation handling by adding PMCOE enrichment logic and updating tests)
    }))
    .filter((entry): entry is { citation: Citation; citationIndex: number; endIndex: number } =>
      isFiniteNumber(entry.endIndex),
    )
    .filter((entry) => entry.endIndex >= 0 && entry.endIndex <= text.length)
    .sort((a, b) => b.endIndex - a.endIndex);

  if (!annotations.length) {
    return {
      processedText: insertMarkersBySentence(text, renderableEntries, citationNumberMapping),
      citedCitations: renderableEntries.map(({ citation }) => citation),
      citationNumberMapping,
    };
  }

  const seenInsertions = new Set<string>();
  let processedText = text;

  // Insert markers from right to left so earlier insertions do not shift the
  // offsets for citations that appear later in the text.
  annotations.forEach(({ citation, citationIndex, endIndex }) => {
    const displayNumber = citationNumberMapping[citationIndex];
    const insertionKey = `${endIndex}-${displayNumber}`;
    if (seenInsertions.has(insertionKey)) {
      return;
    }

    const marker = ` [${displayNumber}](<${encodeURI(citation.url)}>)`;
    const offset = endIndex;
    processedText = `${processedText.slice(0, offset)}${marker}${processedText.slice(offset)}`;
    seenInsertions.add(insertionKey);
  });

  return {
    processedText,
    citedCitations: renderableEntries.map(({ citation }) => citation),
    citationNumberMapping,
  };
};

/**
 * Convert either legacy [docN] markers or annotation-style citations into the
 * markdown link format rendered by the Playground message bubble.
 */
export const processTextWithCitations = (
  text: string,
  citations: Citation[] = [],
): ProcessedCitationsResult => {
  if (!citations.length) {
    return {
      processedText: text,
      citedCitations: [],
      citationNumberMapping: {},
    };
  }

  if (DOC_REFERENCE_TEST_REGEX.test(text)) {
    const { citationNumberMapping, citedCitations } = buildDocMarkerCitationMap(
      text,
      citations,
    );
    const processedText = replaceDocReferences(text, citations, citationNumberMapping);

    return {
      processedText,
      citedCitations,
      citationNumberMapping,
    };
  }

  const explicitCitationLinks = processExplicitCitationLinks(text, citations);
  if (explicitCitationLinks) {
    return explicitCitationLinks;
  }

  return processAnnotationReferences(text, citations);
};

/**
 * Group cited entries by normalized URL so repeated excerpts from the same
 * source collapse into one chip and one drawer section.
 */
export const groupCitationsByUrl = (
  citedCitations: Citation[],
  allCitations: Citation[],
  citationNumberMapping: Record<number, number>,
): GroupedCitation[] => {
  const groups = new Map<string, GroupedCitation>();

  citedCitations.forEach((citation) => {
    const normalizedUrl = safeDecodeUri(citation.url);
    const existing = groups.get(normalizedUrl);
    const fullIndex = allCitations.findIndex((entry) => entry === citation);
    const docNumber = fullIndex >= 0 ? fullIndex + 1 : undefined;
    const displayNumber = docNumber
      ? citationNumberMapping[docNumber] ?? Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;

    if (!existing) {
      groups.set(normalizedUrl, {
        url: normalizedUrl,
        title: citation.title || normalizedUrl,
        citations: [citation],
        displayNumber,
      });
      return;
    }

    existing.citations.push(citation);
    if (displayNumber < existing.displayNumber) {
      existing.displayNumber = displayNumber;
    }
  });

  return Array.from(groups.values()).sort((a, b) => a.displayNumber - b.displayNumber);
};

/**
 * Extract citation annotations from a finalized Responses API payload.
 */
export const extractResponseCitations = (response: unknown): Citation[] => {
  if (!response || typeof response !== "object") {
    return [];
  }

  const responseRecord = response as Record<string, unknown>;
  const output = Array.isArray(responseRecord.output)
    ? (responseRecord.output as Record<string, unknown>[])
    : [];
  const citations: Citation[] = [];

  output.forEach((outputItem) => {
    const contentItems = Array.isArray(outputItem.content)
      ? (outputItem.content as Record<string, unknown>[])
      : [];

    contentItems.forEach((contentItem) => {
      const annotations = Array.isArray(contentItem.annotations)
        ? (contentItem.annotations as Record<string, unknown>[])
        : [];

      annotations.forEach((annotation) => {
        if (annotation.type !== "url_citation") {
          return;
        }

        const url = toNonEmptyString(annotation.url);
        if (!url) {
          return;
        }

        const title = toNonEmptyString(annotation.title) || url;
        const content = toNonEmptyString(annotation.text);
        const startIndex = isFiniteNumber(annotation.start_index)
          ? (annotation.start_index as number)
          : undefined;
        const endIndex = isFiniteNumber(annotation.end_index)
          ? (annotation.end_index as number)
          : undefined;

        citations.push({
          title,
          url,
          content,
          startIndex,
          endIndex,
        });
      });
    });
  });

  return mergeCitations([], citations);
};