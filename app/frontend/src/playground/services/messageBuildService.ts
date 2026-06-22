/**
 * Message / system-prompt build service.
 *
 * Extracted from assistantThunks.ts — isolates system prompt construction,
 * preflight routing context injection, and MCP-specific message assembly
 * so the thunk file can act as a thin orchestrator.
 *
 * Public surface:
 *   - buildPlaygroundChartSystemMessage
 *   - buildPreflightRoutingContextMessage
 *   - buildMcpGroundingSystemMessage
 *   - buildBitsFilterSystemMessage
 *   - buildCompletionMessagesForRun
 *   - trimCompletionMessagesToLimit
 *   System prompt constants (exported for reuse/testing):
 *   - PLAYGROUND_CHART_SYSTEM_PROMPT_EN
 *   - PLAYGROUND_CHART_SYSTEM_PROMPT_FR
 *   - MCP_GROUNDING_SYSTEM_PROMPT
 *   - BITS_FILTER_ENFORCEMENT_SYSTEM_PROMPT
 *   - MCP_GROUNDED_REWRITE_SYSTEM_PROMPT
 *   - MCP_CITATION_HARVEST_SYSTEM_PROMPT
 */

import type { Tool } from "openai/resources/responses/responses.mjs";
import type { CompletionMessage } from "./completionService";
import i18n from "../../i18n";
import { hasBitsServer, inferBitsFilterHintsFromPrompt } from "./bitsTransformService";

// ---------------------------------------------------------------------------
// Session utilities
// ---------------------------------------------------------------------------

/**
 * Derive a short session name from the first 5 words of the user's first
 * message. Keeps the title within 30 characters.
 */
export const deriveSessionName = (content: string): string => {
  const words = content.trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 5).join(" ").slice(0, 30);
};

// ---------------------------------------------------------------------------
// System prompt constants
// ---------------------------------------------------------------------------

export const PLAYGROUND_CHART_SYSTEM_PROMPT_EN =
  "When the user asks for a chart, graph, diagram, flowchart, sequence diagram, gantt, timeline, pie chart, bar chart, or a similar visual, respond with Mermaid markdown by default using a fenced ```mermaid block. Use renderer-stable Mermaid syntax only (for example: pie, graph/flowchart, sequenceDiagram, stateDiagram, classDiagram, gantt, timeline). Avoid experimental or often-invalid directives such as xychart-beta unless the user explicitly requests that syntax. Keep Mermaid syntax valid and complete with no placeholders. For bar-chart requests, if a stable Mermaid bar chart syntax is not available, provide the closest valid Mermaid diagram plus a compact bullet list of label:value pairs. Do not return Python, matplotlib, seaborn, plotly, pandas, or JavaScript chart code unless the user explicitly asks for executable code.";

export const PLAYGROUND_CHART_SYSTEM_PROMPT_FR =
  "Lorsque l'utilisateur demande un graphique, un diagramme, un organigramme, un diagramme de sequence, un diagramme de Gantt, une chronologie, un graphique circulaire, un graphique en barres ou un autre visuel semblable, repondez par defaut avec du Markdown Mermaid dans un bloc delimite ```mermaid. Utilisez seulement une syntaxe Mermaid stable pour le rendu (par exemple: pie, graph/flowchart, sequenceDiagram, stateDiagram, classDiagram, gantt, timeline). Evitez les directives experimentales ou souvent invalides comme xychart-beta, sauf si l'utilisateur demande explicitement cette syntaxe. La syntaxe Mermaid doit etre complete et valide. Pour les demandes de graphique en barres, si une syntaxe Mermaid stable n'est pas disponible, fournissez le diagramme Mermaid valide le plus proche et une liste compacte de paires etiquette:valeur. Ne retournez pas de code Python, matplotlib, seaborn, plotly, pandas ou JavaScript sauf si l'utilisateur demande explicitement du code executable.";

export const MCP_CITATION_HARVEST_SYSTEM_PROMPT = [
  "You are gathering authoritative source material for a user request.",
  "Use the available MCP tools to retrieve the most relevant official sources, excerpts, and citations.",
  "Review all relevant sources returned by the MCP server before responding.",
  "Prioritize source quality over prose quality.",
  "Keep the answer brief and grounded in the retrieved material.",
].join(" ");

export const MCP_GROUNDING_SYSTEM_PROMPT = [
  "You may receive source-bearing data from routed MCP servers.",
  "When MCP output includes source snippets, citation content, article passages, chunk text, page details, or document titles, treat that material as the primary evidence for your answer.",
  "Do not expand acronyms, rename systems, or substitute more familiar terminology from memory when the source material provides the official wording.",
  "If explicit source wording conflicts with the user's wording or your prior knowledge, prefer the source wording, especially for official names, acronyms, and terminology.",
  "Mention returned document titles when useful, and if the source data is sparse, ambiguous, or conflicting, state that limitation instead of filling the gap with unsupported details.",
].join(" ");

export const BITS_FILTER_ENFORCEMENT_SYSTEM_PROMPT = [
  "When routed MCP tools include BITS/business-request servers, you must apply all explicit user constraints as retrieval filters before producing analysis or charts.",
  "Convert constraints such as date windows, client/organization, priority, status, phase, BR owner, and BA/OPI into query filters in the tool call payload.",
  "For month-based requests (for example, March), use an inclusive calendar date range for that month unless the user gave a different range.",
  "For chart requests, first retrieve the filtered BR dataset with those filters, then compute and render the chart from that filtered dataset.",
  "Do not silently drop or relax explicit filters. If a required filter value is ambiguous, ask a clarification question before finalizing the result.",
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

// ---------------------------------------------------------------------------
// Private constants
// ---------------------------------------------------------------------------

const MAX_COMPLETION_MESSAGES = 10;

// ---------------------------------------------------------------------------
// Public builders
// ---------------------------------------------------------------------------

type PreflightRecommendation = {
  category?: string;
  mcp_server_id?: string;
};

/**
 * Convert orchestrator preflight output into a compact routing summary that
 * can be injected as a system message for the completion call.
 */
export const buildPreflightRoutingContextMessage = (
  routing: unknown,
): CompletionMessage => {
  const routingRecord = routing as {
    recommendations?: PreflightRecommendation[];
    fallback?: { category?: string };
  };

  const recommendations = Array.isArray(routingRecord?.recommendations)
    ? routingRecord.recommendations.filter(
        (entry): entry is PreflightRecommendation =>
          Boolean(entry && typeof entry === "object"),
      )
    : [];

  const categories = Array.from(
    new Set(
      recommendations
        .map((entry) =>
          typeof entry.category === "string" ? entry.category.trim() : "",
        )
        .filter((value) => value.length > 0),
    ),
  );

  const serverIds = recommendations
    .map((entry) =>
      typeof entry.mcp_server_id === "string" ? entry.mcp_server_id.trim() : "",
    )
    .filter((value) => value.length > 0);

  const fallbackCategory =
    typeof routingRecord?.fallback?.category === "string"
      ? routingRecord.fallback.category.trim()
      : "";

  const categorySummary =
    categories.length > 0
      ? categories.join(", ")
      : fallbackCategory || "general";
  const serverSummary = serverIds.length > 0 ? serverIds.join(", ") : "none";

  return {
    role: "system",
    content: `Orchestrator preflight routing summary: categories='${categorySummary}', servers='${serverSummary}'. Use this as routing context.`,
  };
};

/**
 * Build the Mermaid-first chart system message in the active UI language.
 */
export const buildPlaygroundChartSystemMessage = (): CompletionMessage => ({
  role: "system",
  content: i18n.language?.toLowerCase().startsWith("fr")
    ? PLAYGROUND_CHART_SYSTEM_PROMPT_FR
    : PLAYGROUND_CHART_SYSTEM_PROMPT_EN,
});

/**
 * Prepend a generic MCP grounding instruction when routed servers are present.
 */
export const buildMcpGroundingSystemMessage = (
  routedServers: Tool.Mcp[],
): CompletionMessage | undefined => {
  if (routedServers.length === 0) return undefined;
  return { role: "system", content: MCP_GROUNDING_SYSTEM_PROMPT };
};

/**
 * Add a BITS-specific retrieval constraint prompt so filtering intent is
 * preserved when the model generates tool payloads.
 */
export const buildBitsFilterSystemMessage = (
  routedServers: Tool.Mcp[],
  userPrompt: string,
): CompletionMessage | undefined => {
  if (!hasBitsServer(routedServers)) return undefined;

  const isFrench = i18n.language?.toLowerCase().startsWith("fr") ?? false;
  const inferredHints = inferBitsFilterHintsFromPrompt(userPrompt, isFrench);
  const hintsBlock =
    inferredHints.length > 0
      ? `\nInferred query filters from the current user request (apply unless user corrects them):\n${inferredHints.map((h) => `- ${h}`).join("\n")}`
      : "";

  return {
    role: "system",
    content: `${BITS_FILTER_ENFORCEMENT_SYSTEM_PROMPT}${hintsBlock}`,
  };
};

/**
 * Assemble the final message list for a completion run that has routed MCP
 * servers, prepending grounding and filter system messages as needed.
 */
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
  if (routedServers.length === 0) return baseMessages;

  const groundingSystemMessage = buildMcpGroundingSystemMessage(routedServers);
  const bitsFilterSystemMessage = buildBitsFilterSystemMessage(
    routedServers,
    userPrompt,
  );

  return [
    ...(groundingSystemMessage ? [groundingSystemMessage] : []),
    ...(bitsFilterSystemMessage ? [bitsFilterSystemMessage] : []),
    ...(preflightRoutingContextMessage ? [preflightRoutingContextMessage] : []),
    ...baseMessages,
  ];
};

/**
 * Trim the message list to `maxMessages` while always preserving leading
 * system messages and the most recent history entries.
 */
export const trimCompletionMessagesToLimit = (
  messages: CompletionMessage[],
  maxMessages: number = MAX_COMPLETION_MESSAGES,
): { messages: CompletionMessage[]; wasTruncated: boolean } => {
  if (messages.length <= maxMessages) {
    return { messages, wasTruncated: false };
  }

  let leadingSystemCount = 0;
  while (
    leadingSystemCount < messages.length
    && messages[leadingSystemCount].role === "system"
  ) {
    leadingSystemCount += 1;
  }

  const leadingSystem = messages.slice(0, leadingSystemCount);
  const history = messages.slice(leadingSystemCount);

  if (leadingSystem.length >= maxMessages) {
    return {
      messages: leadingSystem.slice(-maxMessages),
      wasTruncated: true,
    };
  }

  const availableHistorySlots = Math.max(
    0,
    maxMessages - leadingSystem.length,
  );
  const trimmedHistory =
    history.length > availableHistorySlots
      ? history.slice(-availableHistorySlots)
      : history;

  return {
    messages: [...leadingSystem, ...trimmedHistory],
    wasTruncated: true,
  };
};
