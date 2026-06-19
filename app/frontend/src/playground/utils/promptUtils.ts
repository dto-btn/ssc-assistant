/**
 * Prompt text normalisation utilities shared across playground services.
 *
 * These helpers normalise free-text prompts so that French and English input
 * can share a single matching/inference code path.
 */

/**
 * Normalise a prompt string for intent-detection matching:
 *  - Removes combining diacritic marks (NFD decomposition + strip).
 *  - Lowercases the result.
 *
 * This lets patterns written in plain ASCII match accented French input
 * without duplicating each pattern.
 *
 * @example
 *   normalizePromptForInference("Élevée") // → "elevee"
 */
export const normalizePromptForInference = (value: string): string => {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
};
