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

const toSlug = (value: string, maxLength = 28): string => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
};

const fnv1aBase36 = (value: string): string => {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
};

const toSyntheticCitationUrl = (
  title: string | undefined,
  content: string | undefined,
  startIndex: number | undefined,
  endIndex: number | undefined,
): string => {
  const primary = title || content || "reference";
  const slug = toSlug(primary);
  const seed = [title || "", content || "", startIndex ?? "", endIndex ?? ""].join("|");
  const token = fnv1aBase36(seed || primary);
  return `local-citation://${slug || "reference"}-${token}`;
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

const buildCitationFromRecord = (
  record: Record<string, unknown>,
  inCitationContext: boolean,
): Citation | undefined => {
  const type = toNonEmptyString(record.type)?.toLowerCase();
  const resolvedUrl = resolveCitationUrl(record);

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

  const isTypedCitation = type === "url_citation" || type === "citation";
  const isCitationLike = isTypedCitation || inCitationContext || Boolean(title) || Boolean(content) || Boolean(resolvedUrl);
  if (!isCitationLike) {
    return undefined;
  }

  const normalizedTitle = (title || "").trim().toLowerCase();
  const normalizedContent = (content || "").trim().toLowerCase();
  const looksLikeFile = Boolean(title && /(\.pdf$|\.docx?$|\.pptx?$|-pdf$|guide|manual|policy|framework|operating|process|standard)/i.test(title));
  const hasMeaningfulExcerpt = Boolean(content && content.trim().length >= 35);
  const isMetadataNoiseTitle = /^(query|doc[\s_]?id|id|score|metadata|filter|filters|source id)$/i.test(normalizedTitle);
  const isMetadataNoiseContent = /^(query|doc[\s_]?id|id|score|metadata)$/i.test(normalizedContent);

  // Skip obvious metadata entries that frequently appear in MCP payloads.
  if (!resolvedUrl && isMetadataNoiseTitle && !hasMeaningfulExcerpt) {
    return undefined;
  }
  if (!resolvedUrl && isMetadataNoiseContent && !looksLikeFile) {
    return undefined;
  }

  // For missing-url citations, keep only high-confidence citation-like entries.
  if (!resolvedUrl && !isTypedCitation && !looksLikeFile && !hasMeaningfulExcerpt) {
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

  const url = resolvedUrl || toSyntheticCitationUrl(title, content, startIndex, endIndex);

  return {
    title: title || url,
    url,
    content,
    startIndex,
    endIndex,
  };
};

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

const insertMarkersBySentence = (
  text: string,
  citations: Citation[],
  citationNumberMapping: Record<number, number>,
): string => {
  const sentenceEnds = collectSentenceEndPositions(text);
  const withIndices = citations.map((citation, index) => ({ citation, citationIndex: index + 1 }));
  let processedText = text;
  let offset = 0;

  withIndices.forEach(({ citation, citationIndex }, idx) => {
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

export const extractCitationsFromPayload = (payload: unknown): Citation[] => {
  const found: Citation[] = [];
  const visited = new WeakSet<object>();

  const walk = (value: unknown, inCitationContext = false): void => {
    const parsedObject = getRecord(value);
    if (parsedObject) {
      if (visited.has(parsedObject)) {
        return;
      }
      visited.add(parsedObject);

      const citation = buildCitationFromRecord(parsedObject, inCitationContext);
      if (citation) {
        found.push(citation);
      }

      Object.entries(parsedObject).forEach(([key, child]) => {
        const childContext = inCitationContext || key.toLowerCase().includes("citation");
        if (typeof child === "string") {
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

export const safeDecodeUri = (url: string): string => {
  try {
    return decodeURI(url);
  } catch {
    return url;
  }
};

const buildDocMarkerCitationMap = (
  text: string,
  citations: Citation[],
): { citationNumberMapping: Record<number, number>; citedCitations: Citation[] } => {
  const citationNumberMapping: Record<number, number> = {};

  citations.forEach((_, index) => {
    const docNumber = index + 1;
    if (text.includes(`[doc${docNumber}]`)) {
      citationNumberMapping[docNumber] = Object.keys(citationNumberMapping).length + 1;
    }
  });

  const citedCitations = citations.filter((_, index) => {
    const docNumber = index + 1;
    return citationNumberMapping[docNumber] !== undefined;
  });

  return { citationNumberMapping, citedCitations };
};

const replaceDocReferences = (
  text: string,
  citations: Citation[],
  citationNumberMapping: Record<number, number>,
): string => {
  return text.replace(DOC_REFERENCE_REGEX, (_, docNumberText) => {
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
};

const processAnnotationReferences = (
  text: string,
  citations: Citation[],
): ProcessedCitationsResult => {
  if (!citations.length) {
    return {
      processedText: text,
      citedCitations: [],
      citationNumberMapping: {},
    };
  }

  const citationNumberMapping: Record<number, number> = {};
  citations.forEach((citation, index) => {
    void citation;
    citationNumberMapping[index + 1] = index + 1;
  });

  const annotations = citations
    .map((citation, index) => ({
      citation,
      citationIndex: index + 1,
      endIndex: inferCitationEndIndex(text, citation),
    }))
    .filter((entry): entry is { citation: Citation; citationIndex: number; endIndex: number } =>
      isFiniteNumber(entry.endIndex),
    )
    .filter((entry) => entry.endIndex >= 0 && entry.endIndex <= text.length)
    .sort((a, b) => b.endIndex - a.endIndex);

  if (!annotations.length) {
    return {
      processedText: insertMarkersBySentence(text, citations, citationNumberMapping),
      citedCitations: citations,
      citationNumberMapping,
    };
  }

  const seenInsertions = new Set<string>();
  let processedText = text;

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
    citedCitations: citations,
    citationNumberMapping,
  };
};

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

  return processAnnotationReferences(text, citations);
};

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