/**
 * Assistant orchestration thunks.
 *
 * Wires orchestrator-guided MCP routing into the chat send path, including
 * progress streaming, fallback behavior, and selected-server capture for UI
 * visibility.
 */
import {
  addMessage,
  updateMessageContent,
  setSessionLoading,
  setAssistantResponsePhase,
  setOrchestratorInsights,
  Message,
  MessageMcpAttribution,
  OrchestratorInsights,
} from "../slices/chatSlice";
import { setIsSessionNew, renameSession } from "../slices/sessionSlice";
import { addToast } from "../slices/toastSlice";
import {
  completionService,
  CompletionMessage,
  CompletionContentPart,
  CompletionResult,
} from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";
import { AppThunk, AppDispatch } from "..";
import type { RootState } from "..";
import i18n from "../../../i18n";

import { FileAttachment } from "../../types";
import { extractFileText, fetchFileDataUrl } from "../../api/storage";
import { Tool } from "openai/resources/responses/responses.mjs";
import {
  getOrchestratorInsights,
  OrchestratorProgressEvent,
  resolveServersFromInsights,
} from "../../services/orchestratorService";
import { Citation } from "../../utils/citations";
import { createStreamTypewriter } from "../../utils/streamTypewriter";

/**
 * Per-session AbortControllers for in-flight streaming requests.
 * Stored outside Redux because AbortController instances are not serializable.
 * The map is keyed by sessionId and cleaned up in the thunk's finally block.
 */
const sessionAbortControllers = new Map<string, AbortController>();

/**
 * Cancels the active streaming request for the given session.
 * Safe to call even if no request is in-flight (no-op).
 */
export function stopAssistantMessage(sessionId: string): void {
  sessionAbortControllers.get(sessionId)?.abort();
}

const ATTACHMENT_TEXT_LIMIT = 12000;
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
/**
 * Static EPS fallback citations are used only when enrichment cannot recover
 * enough authoritative concrete sources. Keep this synchronized with the
 * approved source-of-truth content pipeline.
 */
const CANONICAL_EPS_CITATION_FALLBACK: Citation[] = [
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
const PLAYGROUND_CHART_SYSTEM_PROMPT_EN = "When the user asks for a chart, graph, diagram, flowchart, sequence diagram, gantt, timeline, pie chart, or a similar visual, respond with Mermaid markdown by default using a fenced ```mermaid block. Do not return Python, matplotlib, seaborn, plotly, pandas, or JavaScript chart code unless the user explicitly asks for executable code. If Mermaid cannot represent the exact chart, provide the closest Mermaid diagram and briefly state the limitation.";
const PLAYGROUND_CHART_SYSTEM_PROMPT_FR = "Lorsque l'utilisateur demande un graphique, un diagramme, un organigramme, un diagramme de sequence, un diagramme de Gantt, une chronologie, un graphique circulaire ou un autre visuel semblable, repondez par defaut avec du Markdown Mermaid dans un bloc delimite ```mermaid. Ne retournez pas de code Python, matplotlib, seaborn, plotly, pandas ou JavaScript sauf si l'utilisateur demande explicitement du code executable. Si Mermaid ne peut pas representer exactement le visuel demande, fournissez le diagramme Mermaid le plus proche et mentionnez brievement la limite.";
const MCP_CITATION_HARVEST_SYSTEM_PROMPT = [
  "You are gathering authoritative source material for a user request.",
  "Use the available MCP tools to retrieve the most relevant official sources, excerpts, and citations.",
  "Review all relevant sources returned by the MCP server before responding.",
  "Prioritize source quality over prose quality.",
  "Keep the answer brief and grounded in the retrieved material.",
].join(" ");

type PreflightRecommendation = {
  category?: string;
  mcp_server_id?: string;
};

/**
 * Convert orchestrator preflight output into a compact routing summary that
 * can be injected as a system message for the completion call.
 */
const buildPreflightRoutingContextMessage = (routing: unknown): string => {
  const routingRecord = routing as {
    recommendations?: PreflightRecommendation[];
    fallback?: { category?: string };
  };

  const recommendations = Array.isArray(routingRecord?.recommendations)
    ? routingRecord.recommendations
        .filter((entry): entry is PreflightRecommendation => Boolean(entry && typeof entry === "object"))
    : [];

  const categories = Array.from(new Set(
    recommendations
      .map((entry) => (typeof entry.category === "string" ? entry.category.trim() : ""))
      .filter((value) => value.length > 0),
  ));

  const serverIds = recommendations
    .map((entry) => (typeof entry.mcp_server_id === "string" ? entry.mcp_server_id.trim() : ""))
    .filter((value) => value.length > 0);

  const fallbackCategory =
    typeof routingRecord?.fallback?.category === "string"
      ? routingRecord.fallback.category.trim()
      : "";

  const categorySummary = categories.length > 0
    ? categories.join(", ")
    : fallbackCategory || "general";
  const serverSummary = serverIds.length > 0 ? serverIds.join(", ") : "none";

  return `Orchestrator preflight routing summary: categories='${categorySummary}', servers='${serverSummary}'. Use this as routing context.`;
};

/**
 * Prefer Mermaid-first chart answers so Playground can render visuals inline.
 */
const buildPlaygroundChartSystemMessage = (): CompletionMessage => ({
  role: "system",
  content: i18n.language?.toLowerCase().startsWith("fr")
    ? PLAYGROUND_CHART_SYSTEM_PROMPT_FR
    : PLAYGROUND_CHART_SYSTEM_PROMPT_EN,
});

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

const stripSyntheticCitationsWhenConcreteExists = (citations: Citation[] = []): Citation[] => {
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

const selectCanonicalEpsCitations = (citations: Citation[] = []): Citation[] => {
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

const mergeCitationsPreferConcreteUrls = (
  primary: Citation[] = [],
  fallback: Citation[] = [],
): Citation[] => {
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
/**
 * Derive a short session name from the first 5 words of the user's first message.
 * Keeps title within 30 characters.
 */
export const deriveSessionName = (content: string): string => {
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(" ").slice(0, 30);
};

/**
 * Identify orchestrator MCP entries so they are excluded from downstream tool runs.
 */
const isOrchestratorServer = (server: Tool.Mcp): boolean => {
  const label = `${server.server_label || ""} ${server.server_description || ""}`.toLowerCase();
  return label.includes("orchestrator");
};

const attachmentTextCache = new Map<string, string>();
const attachmentImageCache = new Map<string, string>();
const MAX_ORCHESTRATOR_PROGRESS_UPDATES = 20;
const MAX_GROUNDED_REWRITE_EXCERPT_CHARS = 700;
const IS_DEV = import.meta.env.DEV;
const IS_CITATION_DEBUG_ENABLED = String(import.meta.env.VITE_PLAYGROUND_DEBUG_CITATIONS || "").toLowerCase() === "true";

/**
 * Remove transient tool-call status placeholders once real assistant text is available.
 */
const stripToolCallStatusMessages = (content: string): string =>
  content.replace(TOOL_CALL_STATUS_PATTERN, "\n").replace(/\n{3,}/g, "\n\n").trim();
const MCP_GROUNDING_SYSTEM_PROMPT = [
  "You may receive source-bearing data from routed MCP servers.",
  "When MCP output includes source snippets, citation content, article passages, chunk text, page details, or document titles, treat that material as the primary evidence for your answer.",
  "Do not expand acronyms, rename systems, or substitute more familiar terminology from memory when the source material provides the official wording.",
  "If explicit source wording conflicts with the user's wording or your prior knowledge, prefer the source wording, especially for official names, acronyms, and terminology.",
  "Mention returned document titles when useful, and if the source data is sparse, ambiguous, or conflicting, state that limitation instead of filling the gap with unsupported details.",
].join(" ");
const MCP_GROUNDED_REWRITE_SYSTEM_PROMPT = [
  "You are revising an assistant answer using cited source excerpts returned from MCP tools.",
  "Rewrite the answer so every factual claim is supported by the provided source material.",
  "Use all provided source excerpts, not just the first matching source.",
  "When multiple sources add relevant details, synthesize them together in the final answer.",
  "If a source explicitly defines an acronym, official name, or term, use that exact source wording even when the user's question or the draft answer used a different term.",
  "Keep the answer concise, preserve the draft language, remove unsupported claims, and do not mention this rewrite instruction.",
  "Do not invent citation markers or new sources.",
].join(" ");

/**
 * Remove duplicate servers while preserving first-seen ordering.
 */
const dedupeMcpServers = (servers: Tool.Mcp[]): Tool.Mcp[] => {
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

/**
 * Prepend one generic grounding instruction whenever the playground is about
 * to run with routed MCP servers.
 */
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

/**
 * Build message-scoped MCP attribution from routed servers for UI rendering.
 */
const buildMessageMcpAttribution = (
  routedServers: Tool.Mcp[],
  insights: Pick<OrchestratorInsights, "category" | "status" | "statusMessage"> | null,
): MessageMcpAttribution | undefined => {
  if (routedServers.length === 0) {
    return undefined;
  }

  return {
    source: "live",
    generatedAt: new Date().toISOString(),
    category: insights?.category,
    status: insights?.status,
    statusMessage: insights?.statusMessage,
    servers: routedServers.map((server) => ({
      serverLabel: String(server.server_label || server.server_url || "MCP server"),
      serverUrl: server.server_url,
    })),
  };
};

/**
 * Prevent noisy UI updates when identical progress events are emitted repeatedly.
 */
const isDuplicateProgressUpdate = (
  previous: OrchestratorProgressEvent | undefined,
  next: OrchestratorProgressEvent,
): boolean => {
  if (!previous) return false;
  return (
    previous.status === next.status
    && previous.message === next.message
    && previous.transport === next.transport
  );
};

/**
 * Build a lightweight interim insights object used while routing is in progress.
 */
const buildOrchestratorProgressInsights = (
  event: OrchestratorProgressEvent,
  progressUpdates: OrchestratorProgressEvent[],
): OrchestratorInsights => ({
  category: "routing",
  recommendations: [],
  source: "orchestrator",
  transport: event.transport,
  status: event.status,
  statusMessage: event.message,
  progressUpdates,
  timestamp: event.timestamp,
});

/**
 * Feature flag for orchestrator preflight classification/routing.
 */
const shouldUseOrchestratorPreflight = (): boolean => {
  return import.meta.env.VITE_PLAYGROUND_ORCHESTRATOR_PREFLIGHT !== "false";
};

/**
 * Resolve model id for LiteLLM-backed Playground calls.
 */
const resolveCompletionModel = (state: RootState): string => {
  const selectedModel = String(state.models?.selectedModel || "").trim();

  // Explicit env override has highest priority for LiteLLM-backed Playground calls.
  const configuredLiteLLMModel = String(import.meta.env.VITE_LITELLM_MODEL || "").trim();
  if (configuredLiteLLMModel) {
    return configuredLiteLLMModel;
  }

  // Preserve manually selected model when present.
  if (selectedModel) {
    // Map legacy/default selections to the currently configured LiteLLM model id.
    if (["gpt-3.5", "gpt-4", "gpt-4-turbo"].includes(selectedModel)) {
      return "gpt-4o";
    }
    return selectedModel;
  }

  // Fallback must be non-empty for /v1/responses.
  return "gpt-4o";
};

/**
 * Locate orchestrator MCP server definition from configured tool servers.
 */
const findOrchestratorServer = (servers: Tool.Mcp[]): Tool.Mcp | undefined => {
  return servers.find((server) => {
    const label = String(server.server_label || "").toLowerCase();
    const description = String(server.server_description || "").toLowerCase();
    return label.includes("orchestrator") || description.includes("orchestrator");
  });
};

/**
 * Translate orchestrator MCP endpoint into the preflight REST route.
 */
const toOrchestratorPreflightUrl = (serverUrl: string): string => {
  const trimmed = serverUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/mcp")) {
    return `${trimmed.slice(0, -4)}/orchestrator/suggest-route`;
  }
  return `${trimmed}/orchestrator/suggest-route`;
};

/**
 * Extract text content from the most recent user message for preflight routing.
 */
const extractLastUserText = (messages: CompletionMessage[]): string => {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i];
    if (message.role !== "user") {
      continue;
    }
    if (typeof message.content === "string") {
      return message.content;
    }
    const textParts = message.content
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    if (textParts.trim()) {
      return textParts;
    }
  }
  return "";
};

/**
 * Clamp long attachment transcripts so prompts stay within token limits.
 */
const truncateText = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength)}\n\n[Attachment truncated after ${maxLength} characters of ${text.length}.]`;
};

/**
 * Convert attachment metadata into multimodal content parts by pulling text or
 * image data from the storage API and caching the results between requests.
 */
async function resolveAttachmentParts(
  attachments: FileAttachment[] = [],
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<CompletionContentPart[]> {
  const parts: CompletionContentPart[] = [];
  const extractionFailures: string[] = [];
  const emptyExtractions: string[] = [];
  const state = getState();
  const accessToken = state.auth?.accessToken ?? null;

  for (const attachment of attachments) {
    const cacheKey = attachment.blobName || attachment.url;
    const contentType = attachment.contentType ?? undefined;
    const attachmentName = attachment.originalName || attachment.blobName || "attachment";

    if (contentType?.startsWith("image/")) {
      let dataUrl = cacheKey ? attachmentImageCache.get(cacheKey) : undefined;

      if (!dataUrl && (attachment.url || attachment.blobName)) {
        try {
          const result = await fetchFileDataUrl({
            fileUrl: attachment.url,
            blobName: attachment.blobName,
            fileType: contentType,
            accessToken,
          });
          dataUrl = result.dataUrl;
          if (dataUrl && cacheKey) {
            attachmentImageCache.set(cacheKey, dataUrl);
          }
        } catch (error) {
          if (IS_DEV) {
            console.error("Failed to load attachment image", error);
          }
        }
      }

      if (!dataUrl) {
        continue;
      }

      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" is an image. Please describe what you see in the image and use that context when answering the user's request.`,
      });
      parts.push({
        type: "image_url",
        image_url: {
          url: dataUrl,
          detail: "auto",
        },
      });
      continue;
    }

    let resolvedText = cacheKey ? attachmentTextCache.get(cacheKey) : undefined;

    if (!resolvedText && attachment.url) {
      try {
        resolvedText = await extractFileText({
          fileUrl: attachment.url,
          fileType: contentType,
        });
        if (resolvedText && cacheKey) {
          attachmentTextCache.set(cacheKey, resolvedText);
        }
      } catch (error) {
        if (IS_DEV) {
          console.error("Failed to extract attachment text", error);
        }
        extractionFailures.push(attachmentName);
      }
    }

    if (!resolvedText) {
      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" could not be read. Let the user know the file might need to be converted to a different format (for example, CSV or XLSX).`,
      });
      emptyExtractions.push(attachmentName);
      continue;
    }

    const trimmed = resolvedText.trim();
    if (!trimmed) {
      parts.push({
        type: "text",
        text: `Attachment "${attachmentName}" did not contain readable text. Ask the user for a different format if the data seems important.`,
      });
      emptyExtractions.push(attachmentName);
      continue;
    }

    const limited = truncateText(trimmed, ATTACHMENT_TEXT_LIMIT);

    parts.push({
      type: "text",
      text: `Attachment "${attachmentName}" contents:\n\n${limited}`,
    });
  }

  if (extractionFailures.length || emptyExtractions.length) {
    const problems = [...new Set([...extractionFailures, ...emptyExtractions])];
    const message = i18n.t("playground:errors.attachmentExtractionFailed", {
      defaultValue: "Could not read these files: {{files}}.",
      files: problems.join(", "),
    });
    dispatch(
      addToast({
        message,
        isError: true,
      })
    );
  }

  return parts;
}

/**
 * Combine the base message text with any generated attachment parts before sending to the provider.
 */
const buildMessageContent = async (
  message: Message,
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<string | CompletionContentPart[]> => {
  const baseText = message.content?.trim() ?? "";
  const attachmentParts = message.attachments?.length
    ? await resolveAttachmentParts(message.attachments, dispatch, getState)
    : [];

  if (!attachmentParts.length) {
    return baseText;
  }

  const contentParts: CompletionContentPart[] = [];

  if (baseText) {
    contentParts.push({ type: "text", text: baseText });
  }

  contentParts.push(...attachmentParts);

  return contentParts;
};

/**
 * Prepare the full conversation history for a completion call, resolving
 * attachments in parallel to avoid serial network trips.
 */
const mapMessagesForCompletion = async (
  messages: Message[],
  dispatch: AppDispatch,
  getState: () => RootState,
): Promise<CompletionMessage[]> => {
  return Promise.all(
    messages.map(async (message) => {
      const content = await buildMessageContent(message, dispatch, getState);
      if (message.role === "system") {
        const systemContent = typeof content === "string"
          ? content
          : content
              .map((part) => (part.type === "text" ? part.text : "[non-text attachment omitted]"))
              .join("\n");

        const systemMessage: CompletionMessage = {
          role: "system",
          content: systemContent,
        };

        return systemMessage;
      }

      if (message.role === "assistant") {
        const assistantContent = typeof content === "string"
          ? content
          : content
              .map((part) => (part.type === "text" ? part.text : "[non-text attachment omitted]"))
              .join("\n");

        const assistantMessage: CompletionMessage = {
          role: "assistant",
          content: assistantContent,
        };

        return assistantMessage;
      }

      const userMessage: CompletionMessage = {
        role: "user",
        content,
      };

      return userMessage;
    })
  );
};

export interface SendAssistantMessageArgs {
  sessionId: string;
  content: string;
  attachments?: FileAttachment[];
  provider?: 'azure-openai' | 'aws-bedrock'; // Future provider selection
}

/**
 * Primary chat execution thunk for one user turn.
 *
 * Flow summary:
 * 1) Validate auth and discover orchestrator server.
 * 2) Ask orchestrator to classify and select downstream MCP servers.
 * 3) Build completion messages (including attachment hydration).
 * 4) Stream model output and keep Redux message content in sync.
 */
export const sendAssistantMessage = ({
  sessionId,
  content,
  attachments,
  provider = 'azure-openai', // Default provider
}: SendAssistantMessageArgs): AppThunk<Promise<void>> => async (
  dispatch,
  getState
) => {
  dispatch(setSessionLoading({ sessionId, loading: true }));
  dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));
  const abortController = new AbortController();
  sessionAbortControllers.set(sessionId, abortController);
  try {
    const { accessToken } = getState().auth;
    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: i18n.t("playground:auth.tokenExpired"),
          isError: true,
        })
      );
      dispatch(setSessionLoading({ sessionId, loading: false }));
      return;
    }

    const isNewChat = getState().sessions.sessions.find((s) => s.id === sessionId)?.isNewChat;
    if (isNewChat) {
      const meaningfulText = content.trim().length > 0;
      const meaningfulTurn = meaningfulText || (attachments && attachments.length > 0);

      if (meaningfulText) {
        // Rename chat if this is the first message with text in a new session
        const autoName = deriveSessionName(content);
        if (autoName) {
          dispatch(renameSession({ id: sessionId, name: autoName }));
        }
      }

      if (meaningfulTurn) {
        // Mark session as no longer new if there's text or attachments
        dispatch(setIsSessionNew({ id: sessionId, isNew: false }));
      }
    }

    const dispatchForAttachments = dispatch as AppDispatch;
    const { mcpServers } = getState().tools;
    const existingSessionMessages = getState().chat.messages.filter(
      (message) => message.sessionId === sessionId
    );

    const serversWithAuth: Tool.Mcp[] = (mcpServers || []).map((server: Tool.Mcp) => ({
      ...server,
      authorization: accessToken,
    }));

    const hasOrchestratorServer = serversWithAuth.some(isOrchestratorServer);
    if (!hasOrchestratorServer) {
      dispatch(
        addToast({
          message: "Orchestrator MCP is not configured; routing will fall back to available MCP servers.",
          isError: false,
        })
      );
    }

    const progressUpdates: OrchestratorProgressEvent[] = [];

    const orchestratorInsights = hasOrchestratorServer
      ? await getOrchestratorInsights({
          messages: existingSessionMessages,
          currentContent: content,
          servers: serversWithAuth,
          accessToken,
          onProgress: (event: OrchestratorProgressEvent) => {
            // Keep only meaningful transitions so progress UI stays readable.
            if (isDuplicateProgressUpdate(progressUpdates[progressUpdates.length - 1], event)) {
              return;
            }
            progressUpdates.push(event);
            if (progressUpdates.length > MAX_ORCHESTRATOR_PROGRESS_UPDATES) {
              progressUpdates.shift();
            }
            dispatch(
              setOrchestratorInsights({
                sessionId,
                insights: buildOrchestratorProgressInsights(event, progressUpdates.slice()),
              })
            );
          },
        })
      : null;

    // If orchestrator is unavailable, preserve existing behavior by using configured downstream servers.
    const orchestratorUnavailable = !orchestratorInsights;

    const downstreamServers = serversWithAuth.filter((server) => !isOrchestratorServer(server));

    const orchestratorRecommendedServers = orchestratorUnavailable
      ? []
      : resolveServersFromInsights(orchestratorInsights, serversWithAuth);

    const routedServers = orchestratorUnavailable
      ? dedupeMcpServers(downstreamServers)
      : orchestratorRecommendedServers.length > 0
        // Orchestrator recommendations are authoritative when present.
        ? dedupeMcpServers(orchestratorRecommendedServers)
        // If no downstream route is recommended, continue chat without MCP tools.
        : [];

    // Persist the final orchestrator decision snapshot so both end-user and
    // developer panels can explain why a tool route was or was not selected.

    const finalProgress = progressUpdates[progressUpdates.length - 1];

    const baseInsights = orchestratorInsights
      ? {
          ...orchestratorInsights,
          status: finalProgress?.status || "done",
          statusMessage:
            finalProgress?.message ||
            (orchestratorInsights.fallbackReason
              ? "Completed with fallback"
              : "Orchestrator routing completed"),
          progressUpdates: progressUpdates.slice(),
        }
      : hasOrchestratorServer
        ? {
            category: "general",
            recommendations: [],
            source: "orchestrator" as const,
            status: "error" as const,
            statusMessage: finalProgress?.message || "Orchestrator unavailable",
            progressUpdates: progressUpdates.slice(),
            timestamp: finalProgress?.timestamp || new Date().toISOString(),
            error: "orchestrator_unavailable",
          }
        : null;

    const insightsWithSelection = baseInsights && orchestratorRecommendedServers.length > 0
      ? {
          ...baseInsights,
          selectedServers: orchestratorRecommendedServers.map((server) => ({
            server_label: server.server_label,
            server_url: server.server_url || "(no-url)",
          })),
        }
      : baseInsights;

    const assistantMcpAttribution = buildMessageMcpAttribution(
      routedServers,
      insightsWithSelection,
    );

    dispatch(setOrchestratorInsights({ sessionId, insights: insightsWithSelection }));

    // Add user message to state
    dispatch(
      addMessage({
        sessionId,
        role: "user",
        content,
        attachments,
      })
    );

    // Add empty assistant message to state
    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: "",
        mcpAttribution: assistantMcpAttribution,
      })
    );

    // Re-fetch messages to include the newly added assistant message
    const updatedSessionMessages = getState().chat.messages.filter(
      (message) => message.sessionId === sessionId
    );
    const assistantMessages = updatedSessionMessages.filter(
      (message) => message.role === "assistant"
    );
    const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];

    if (!latestAssistantMessage) {
      throw new Error("Failed to create assistant message");
    }

    // Use the completion service with streaming callbacks for state management
    const completionMessages = await mapMessagesForCompletion(updatedSessionMessages, dispatchForAttachments, getState);

    // Ensure every routed MCP server carries an auth token for downstream calls.
    const routedServersWithAuth: Tool.Mcp[] = routedServers.map((server) => ({
      ...server,
      authorization: (server as Tool.Mcp & { authorization?: string }).authorization || accessToken,
    }));

    const chartSystemMessage = buildPlaygroundChartSystemMessage();
    const finalServersWithAuth = routedServersWithAuth;
    const groundingSystemMessage = buildMcpGroundingSystemMessage(finalServersWithAuth);
    let finalMessages = [
      ...(groundingSystemMessage ? [groundingSystemMessage] : []),
      chartSystemMessage,
      ...completionMessages,
    ];

    const orchestratorServer = findOrchestratorServer(serversWithAuth);
    const orchestratorServerUrl = orchestratorServer?.server_url;
    if (shouldUseOrchestratorPreflight() && orchestratorServerUrl) {
      try {
        const preflightResponse = await fetch(toOrchestratorPreflightUrl(orchestratorServerUrl), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: extractLastUserText(completionMessages) }],
            max_recommendations: 3,
            require_single_best: false,
            metadata: { source: "playground-preflight" },
          }),
        });

        if (preflightResponse.ok) {
          const routing = await preflightResponse.json();

          // Feed the model the same routing summary the orchestrator produced
          // without altering the user-visible chat transcript.
          finalMessages = [
            ...(groundingSystemMessage ? [groundingSystemMessage] : []),
            {
              role: "system",
              content: buildPreflightRoutingContextMessage(routing),
            },
            chartSystemMessage,
            ...completionMessages,
          ];
        }
      } catch (preflightError) {
        console.warn("Orchestrator preflight failed, continuing without preflight", preflightError);
      }
    }

    const completionModel = resolveCompletionModel(getState());

    const maybeRewriteAnswerWithCitations = async (
      draftText: string,
      citations: CompletionResult["citations"],
    ): Promise<{
      content: string;
      citations: CompletionResult["citations"];
    }> => {
      if (!draftText.trim() || !citations?.length) {
        return {
          content: draftText,
          citations,
        };
      }

      const seenEvidence = new Set<string>();
      const evidenceBlocks = citations
        .filter((citation) => typeof citation.content === "string" && citation.content.trim().length > 0)
        .filter((citation) => {
          const evidenceKey = `${citation.url}|${citation.content}`;
          if (seenEvidence.has(evidenceKey)) {
            return false;
          }

          seenEvidence.add(evidenceKey);
          return true;
        })
        .map((citation, index) => {
          const title = String(citation.title || citation.url || `Source ${index + 1}`).trim();
          const excerpt = truncateText(citation.content!.trim(), MAX_GROUNDED_REWRITE_EXCERPT_CHARS);
          const location = String(citation.url || "").trim();

          return [
            `Source ${index + 1}: ${title}`,
            location ? `Location: ${location}` : undefined,
            `Excerpt:\n${excerpt}`,
          ]
            .filter((value): value is string => Boolean(value && value.trim().length > 0))
            .join("\n");
        });

      if (evidenceBlocks.length === 0) {
        return {
          content: draftText,
          citations,
        };
      }

      try {
        const rewriteResult = await completionService.createCompletion(
          {
            messages: [
              {
                role: "system",
                content: MCP_GROUNDED_REWRITE_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  "Revise the assistant draft using only the source excerpts below.",
                  `Original user request:\n${content.trim()}`,
                  `Assistant draft:\n${draftText.trim()}`,
                  `Source excerpts:\n${evidenceBlocks.join("\n\n")}`,
                  "Return only the revised answer in the same language as the draft answer.",
                ].join("\n\n"),
              },
            ],
            model: completionModel,
            provider,
            userToken: accessToken,
            signal: abortController.signal,
            servers: [],
          },
          {
            onChunk: () => undefined,
            onToolCall: () => undefined,
            onError: (error: Error) => {
              if (!abortController.signal.aborted && IS_DEV) {
                console.warn("Citation-grounded rewrite failed:", error);
              }
            },
            onComplete: () => undefined,
          }
        );

        const rewrittenText = rewriteResult.fullText.trim();
        if (!rewrittenText) {
          return {
            content: draftText,
            citations,
          };
        }

        return {
          content: rewrittenText,
          // Rewritten text invalidates any annotation offsets from the first pass.
          citations: citations.map((citation) => ({
            title: citation.title,
            url: citation.url,
            content: citation.content,
          })),
        };
      } catch (rewriteError) {
        if (!abortController.signal.aborted && IS_DEV) {
          console.warn("Citation-grounded rewrite failed:", rewriteError);
        }

        return {
          content: draftText,
          citations,
        };
      }
    };

    const harvestStandaloneCitations = async (
      promptText: string,
      draftText: string,
      serversForRun: Tool.Mcp[],
    ): Promise<Citation[]> => {
      if (!promptText.trim() || serversForRun.length === 0) {
        return [];
      }

      try {
        const harvestResult = await completionService.createCompletion(
          {
            messages: [
              {
                role: "system",
                content: MCP_CITATION_HARVEST_SYSTEM_PROMPT,
              },
              {
                role: "user",
                content: [
                  "Retrieve authoritative source excerpts and citations for the request below.",
                  `User request:\n${promptText.trim()}`,
                  draftText.trim() ? `Current assistant draft:\n${draftText.trim()}` : undefined,
                  "Use the available MCP tools. Review all relevant sources returned by the MCP server before responding.",
                  "Return evidence from all relevant source documents, aiming for multiple distinct sources when available.",
                  "Prefer official sources and source excerpts, and do not stop after the first matching source.",
                ]
                  .filter((value): value is string => Boolean(value && value.trim().length > 0))
                  .join("\n\n"),
              },
            ],
            model: completionModel,
            provider,
            userToken: accessToken,
            signal: abortController.signal,
            servers: serversForRun,
            toolChoice: "required",
          },
          {
            onChunk: () => undefined,
            onToolCall: () => undefined,
            onError: (error: Error) => {
              if (!abortController.signal.aborted && IS_DEV) {
                console.warn("Standalone citation harvest failed:", error);
              }
            },
            onComplete: () => undefined,
          }
        );

        return harvestResult.citations || [];
      } catch (harvestError) {
        if (!abortController.signal.aborted && IS_DEV) {
          console.warn("Standalone citation harvest failed:", harvestError);
        }

        return [];
      }
    };

    const runCompletion = async (
      messagesForRun: CompletionMessage[],
      serversForRun: Tool.Mcp[],
    ): Promise<CompletionResult | undefined> => {
      // One execution path used for both primary run and no-tools retry.
      let receivedFirstChunk = false;
      let pendingToolCallStatusText = "";

      const typewriter = createStreamTypewriter({
        tickMs: 20,
        charsPerTick: 4,
        burstMultiplier: 2,
        maxBufferedChars: 900,
        onUpdate: (nextText) => {
          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: nextText,
            })
          );
        },
      });

      let completionResult: CompletionResult | undefined;

      try {
        completionResult = await completionService.createCompletion(
          {
            messages: messagesForRun,
            model: completionModel,
            provider,
            userToken: accessToken,
            servers: serversForRun,
            signal: abortController.signal,
          },
          {
            onChunk: (chunk: string) => {
              if (!receivedFirstChunk && pendingToolCallStatusText) {
                // Clear transient tool-call status before typed response starts.
                pendingToolCallStatusText = "";
                dispatch(
                  updateMessageContent({
                    messageId: latestAssistantMessage.id,
                    content: "",
                  })
                );
              }

              typewriter.enqueue(chunk);
              if (!receivedFirstChunk) {
                receivedFirstChunk = true;
                dispatch(setAssistantResponsePhase({ sessionId, phase: "streaming" }));
              }
            },
            onToolCall: (toolName?: string) => {
              const toolCallMessage = `\n${toolName ?? "A tool"} is being called...\n`;
              if (!receivedFirstChunk) {
                pendingToolCallStatusText += toolCallMessage;
                dispatch(
                  updateMessageContent({
                    messageId: latestAssistantMessage.id,
                    content: pendingToolCallStatusText,
                  })
                );
              }
            },
            onError: (error: Error) => {
              // Abort errors are expected (user clicked Stop) — don't log them.
              if (abortController.signal.aborted) return;
              if (IS_DEV) {
                console.error("Streaming error:", error);
              }
            },
            onComplete: () => undefined,
          }
        );
      } finally {
        const wasAborted = abortController.signal.aborted;

        if (!wasAborted) {
          // Let the buffer drain with pacing to avoid end-of-stream "content dump".
          await typewriter.complete({ maxWaitMs: 5000 });
        }

        const streamedContent = typewriter.getDisplayedText();
        const resolvedContent = streamedContent.trim().length > 0
          ? streamedContent
          : (completionResult?.fullText || streamedContent);
        const cleanedContent = stripToolCallStatusMessages(resolvedContent);

        if (IS_CITATION_DEBUG_ENABLED) {
          console.debug("[playground-citations] litellm completion result", {
            provider,
            model: completionModel,
            citationCount: completionResult?.citations?.length ?? 0,
            citations: completionResult?.citations ?? [],
          });
        }

        // Append a stop marker so the user knows the response was cut short.
        const stopMarker = `\n\n*${i18n.t("playground:assistant.stopped")}*`;
        const finalContent = wasAborted
          ? (cleanedContent.length > 0 ? cleanedContent + stopMarker : stopMarker.trimStart())
          : cleanedContent;
        const rewrittenAnswer = wasAborted
          ? {
              content: finalContent,
              citations: completionResult?.citations,
            }
          : await maybeRewriteAnswerWithCitations(
              cleanedContent,
              completionResult?.citations,
            );
        dispatch(
          updateMessageContent({
            messageId: latestAssistantMessage.id,
            content: rewrittenAnswer.content,
            citations: rewrittenAnswer.citations,
          })
        );

        typewriter.stop();
      }

      return completionResult;

    };

    let completionResult: CompletionResult | undefined;

    try {
      completionResult = await runCompletion(finalMessages, finalServersWithAuth);
    } catch (toolEnabledError) {
      if (finalServersWithAuth.length === 0 || abortController.signal.aborted) {
        throw toolEnabledError;
      }

      dispatch(
        addToast({
          message: "MCP tools were unavailable for this response, so the assistant retried without tools. Citations may be missing.",
          isError: false,
        })
      );

      const retryEvent: OrchestratorProgressEvent = {
        status: "routing",
        message: "Retried without tools after downstream tool failure",
        timestamp: new Date().toISOString(),
        transport: orchestratorInsights?.transport === "streamable-http" ? "streamable-http" : undefined,
      };

      if (!isDuplicateProgressUpdate(progressUpdates[progressUpdates.length - 1], retryEvent)) {
        progressUpdates.push(retryEvent);
        if (progressUpdates.length > MAX_ORCHESTRATOR_PROGRESS_UPDATES) {
          progressUpdates.shift();
        }
      }

      const existingInsights = getState().chat.orchestratorInsightsBySessionId?.[sessionId];
      if (existingInsights) {
        dispatch(
          setOrchestratorInsights({
            sessionId,
            insights: {
              ...existingInsights,
              status: retryEvent.status,
              statusMessage: retryEvent.message,
              progressUpdates: progressUpdates.slice(),
              timestamp: retryEvent.timestamp,
            },
          })
        );
      }

      if (IS_DEV) {
        console.warn(
          "Tool-enabled completion failed; retrying without MCP tools.",
          toolEnabledError
        );
      }

      dispatch(
        updateMessageContent({
          messageId: latestAssistantMessage.id,
          content: "",
          citations: [],
        })
      );

      dispatch(setAssistantResponsePhase({ sessionId, phase: "waiting-first-token" }));

      // Mark this turn as completed without tools so downstream enrichment
      // does not re-trigger the same failing MCP routes.
      completionResult = await runCompletion(finalMessages, []);
    }

    const currentCitations = completionResult?.citations || [];
    const shouldApplyEpsCitationEnrichment = shouldEnrichEpsCitations(content, currentCitations);
    const shouldApplyPmcoeCitationEnrichment =
      !shouldApplyEpsCitationEnrichment && shouldEnrichPmcoeCitations(content, currentCitations);

    if (!abortController.signal.aborted && (shouldApplyEpsCitationEnrichment || shouldApplyPmcoeCitationEnrichment)) {
      const latestMessageContent =
        getState().chat.messages.find((message) => message.id === latestAssistantMessage.id)?.content || "";
      // Harvest only from the server set used by the successful completion path
      // to avoid repeated MCP failures and extra latency.
      const harvestedCitations = await harvestStandaloneCitations(
        content,
        latestMessageContent,
        finalServersWithAuth,
      );

      if (shouldApplyEpsCitationEnrichment) {
        const canonicalEpsCitations = selectCanonicalEpsCitations(harvestedCitations);
        const mergedCitations = canonicalEpsCitations.length > 0
          ? canonicalEpsCitations
          : mergeCitationsPreferConcreteUrls(
              currentCitations,
              harvestedCitations,
            );
        const strippedMergedCitations = stripSyntheticCitationsWhenConcreteExists(mergedCitations);
        const finalEpsCitations = hasRequiredEpsLegacyCitations(strippedMergedCitations)
          ? strippedMergedCitations
          : CANONICAL_EPS_CITATION_FALLBACK;

        if (finalEpsCitations.length > 0) {
          const rewrittenAnswer = await maybeRewriteAnswerWithCitations(
            latestMessageContent,
            finalEpsCitations,
          );
          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: rewrittenAnswer.content,
              citations: rewrittenAnswer.citations,
            })
          );
        }
      } else {
        const mergedPmcoeCitations = mergeCitationsPreferConcreteUrls(
          currentCitations,
          harvestedCitations,
        );
        const finalPmcoeCitations = stripSyntheticCitationsWhenConcreteExists(mergedPmcoeCitations);

        if (finalPmcoeCitations.length > 0) {
          const rewrittenAnswer = await maybeRewriteAnswerWithCitations(
            latestMessageContent,
            finalPmcoeCitations,
          );
          dispatch(
            updateMessageContent({
              messageId: latestAssistantMessage.id,
              content: rewrittenAnswer.content,
              citations: rewrittenAnswer.citations,
            })
          );
        }
      }
    }
  } catch (error) {
    // If the user explicitly stopped the response, swallow the abort error
    // silently — no toast or error message should appear in the chat.
    if (abortController.signal.aborted) {
      return;
    }

    console.error("Completion failed:", error);

    const fallbackToastMessage = i18n.t("playground:assistant.error.toast");
    const assistantErrorMessage = i18n.t("playground:assistant.error.chat");

    const errorMessage =
      error instanceof Error && error.message.trim().length > 0
        ? error.message
        : fallbackToastMessage;

    dispatch(
      addMessage({
        sessionId,
        role: "assistant",
        content: assistantErrorMessage,
      })
    );

    dispatch(
      addToast({
        message: errorMessage,
        isError: true,
      })
    );
  } finally {
    sessionAbortControllers.delete(sessionId);
    dispatch(setAssistantResponsePhase({ sessionId, phase: "idle" }));
    dispatch(setSessionLoading({ sessionId, loading: false }));
  }
};
