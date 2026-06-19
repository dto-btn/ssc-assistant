/**
 * JSON parsing utilities shared across the playground.
 *
 * Provides a fault-tolerant JSON parser that handles strict JSON, markdown-
 * fenced JSON blocks, and JSON embedded inside prose text.
 */

/**
 * Attempt to parse a string as JSON using progressively more permissive
 * strategies.
 *
 * Parsing order:
 *  1. Raw string as-is (strict JSON).
 *  2. Content extracted from the first ```json ... ``` or ``` ... ``` fence.
 *  3. Substring between the first `{` and last `}`.
 *  4. Substring between the first `[` and last `]`.
 *
 * Returns `undefined` when all strategies fail (vs. throwing).
 */
export const tryParseJson = (value: string): unknown => {
  const trimmed = value.trim();
  const candidates: string[] = [trimmed];

  // Fenced code blocks (```json ... ``` or ``` ... ```)
  const fencedMatches = [...trimmed.matchAll(/```(?:json)?\s*([\s\S]*?)```/gi)];
  for (const match of fencedMatches) {
    const candidate = match[1]?.trim();
    if (candidate) {
      candidates.push(candidate);
    }
  }

  // Bare object extraction
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }

  // Bare array extraction
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

/**
 * Attempt to parse a string as JSON, returning only the result when it is a
 * plain object (not an array, primitive, or null). Returns `null` on failure.
 *
 * This is a narrower variant of {@link tryParseJson} used by callers that
 * expect an object and need a `null` sentinel rather than `undefined`.
 */
export const tryParseJsonObject = (
  value: string,
): Record<string, unknown> | null => {
  const result = tryParseJson(value);
  if (result && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return null;
};
