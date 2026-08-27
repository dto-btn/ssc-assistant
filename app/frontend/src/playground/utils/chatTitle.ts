/** Maximum chat title length accepted from the orchestrator. */
export const CHAT_TITLE_MAX_CHARS = 80;

/**
 * Normalize an orchestrator-provided chat title.
 *
 * Shared by the orchestrator service and the assistant thunks so the length
 * cap is enforced in exactly one place.
 */
export const normalizeChatTitle = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized ? normalized.slice(0, CHAT_TITLE_MAX_CHARS) : undefined;
};
