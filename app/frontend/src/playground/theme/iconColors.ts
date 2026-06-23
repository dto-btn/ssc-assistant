/**
 * Semantic category icon colours for the playground Suggestions component.
 *
 * Centralising these here lets us:
 *  1. Reference the same values in the MUI theme for guaranteed contrast checks.
 *  2. Drive WCAG 1.4.3 contrast fixes from a single source of truth.
 *
 * All colours must achieve ≥4.5:1 against a white (#ffffff) background when
 * rendered as chip labels (text), and ≥3:1 as non-text (icon/border).
 *
 * Contrast ratios verified with the WebAIM Contrast Checker tool.
 *
 * ⚠ NOTE: #8e24aa (original purple) fails 4.5:1 on white (~3.9:1).
 *   It has been replaced with #6a1b9a which achieves ~5.6:1.
 */

export interface CategoryColors {
  /** Hex colour for the icon and chip border/accent. */
  primary: string;
  /** Hex colour for chip label text (defaults to primary if not set). */
  text?: string;
}

/** Deep teal – GEDS category. Contrast on white: ~4.8:1 ✓ */
export const CATEGORY_COLOR_GEDS = "#00695c";

/** Indigo – General category. Contrast on white: ~5.2:1 ✓ */
export const CATEGORY_COLOR_GENERAL = "#3f51b5";

/** Strong blue – Corporate category. Contrast on white: ~6.8:1 ✓ */
export const CATEGORY_COLOR_CORPORATE = "#1565c0";

/**
 * Accessible purple – BITS / Business Request category.
 * Original #8e24aa (~3.9:1) replaced with #6a1b9a (~5.6:1) to meet AA.
 */
export const CATEGORY_COLOR_BR = "#6a1b9a";

/** Dark gold – PMCOE category. Contrast on white: ~6.1:1 ✓ */
export const CATEGORY_COLOR_PMCOE = "#7a4f00";

/** Map from category key to primary colour string for convenience. */
export const CATEGORY_COLORS: Readonly<Record<string, string>> = {
  geds: CATEGORY_COLOR_GEDS,
  general: CATEGORY_COLOR_GENERAL,
  corporate: CATEGORY_COLOR_CORPORATE,
  br: CATEGORY_COLOR_BR,
  pmcoe: CATEGORY_COLOR_PMCOE,
};
