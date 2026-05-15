/**
 * Barrel exports for assistant thunk helper modules.
 *
 * This file gives the orchestration thunk a single import surface while the
 * actual implementation is split by concern across focused modules.
 */

// Citation detection, enrichment guards, and merge logic.
export {
  CANONICAL_EPS_CITATION_FALLBACK,
  deriveSessionName,
  hasRequiredEpsLegacyCitations,
  isLikelyEpsCitationQuery,
  isLikelyPmcoeCitationQuery,
  MAX_GROUNDED_REWRITE_EXCERPT_CHARS,
  MCP_CITATION_HARVEST_SYSTEM_PROMPT,
  MCP_GROUNDED_REWRITE_SYSTEM_PROMPT,
  mergeCitationsPreferConcreteUrls,
  selectCanonicalEpsCitations,
  shouldEnrichEpsCitations,
  shouldEnrichPmcoeCitations,
  stripSyntheticCitationsWhenConcreteExists,
  stripToolCallStatusMessages,
} from "./assistantThunks.citations";

// BITS parsing and BITS-specific prompt/runtime helpers.
export {
  BITS_NON_RESULT_TOOL_NAMES,
  BITS_TOOL_NAMES,
  buildCompletionMessagesForRun,
  dedupeMcpServers,
  isBrGuidancePrompt,
  mergeBitsArtifacts,
  parseBitsArtifactsFromToolOutput,
  shouldRequireToolsForRun,
} from "./assistantThunks.bits";

// Orchestrator/preflight routing utilities.
export {
  buildMessageMcpAttribution,
  buildOrchestratorProgressInsights,
  buildPreflightRoutingContextMessage,
  extractLastUserText,
  findOrchestratorServer,
  isDuplicateProgressUpdate,
  isOrchestratorServer,
  MAX_ORCHESTRATOR_PROGRESS_UPDATES,
  resolveCompletionModel,
  shouldUseOrchestratorPreflight,
  toOrchestratorPreflightUrl,
} from "./assistantThunks.orchestrator";

// Message construction, attachment hydration, and reveal constants.
export {
  buildPlaygroundChartSystemMessage,
  FINAL_REVEAL_BURST_MULTIPLIER,
  FINAL_REVEAL_CHARS_PER_TICK,
  FINAL_REVEAL_MAX_BUFFERED_CHARS,
  FINAL_REVEAL_MAX_WAIT_MS,
  FINAL_REVEAL_TICK_MS,
  IS_CITATION_DEBUG_ENABLED,
  IS_DEV,
  mapMessagesForCompletion,
  truncateText,
} from "./assistantThunks.messages";
