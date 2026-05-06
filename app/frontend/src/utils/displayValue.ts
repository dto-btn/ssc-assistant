export interface DisplayValueOptions {
  nullValue?: string | number | null;
  flattenSingleEntryObject?: boolean;
}

/**
 * Normalizes unknown payload values into render-safe primitives for table/card cells.
 */
export const toDisplayValue = (
  value: unknown,
  options: DisplayValueOptions = {},
): string | number | null => {
  const {
    nullValue = "",
    flattenSingleEntryObject = true,
  } = options;

  if (typeof value === "string" || typeof value === "number") {
    return value;
  }

  if (value === null || value === undefined) {
    return nullValue;
  }

  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => String(toDisplayValue(item, { ...options, nullValue: "" }) ?? ""))
      .join(", ");
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (flattenSingleEntryObject && entries.length === 1) {
      const [key, nestedValue] = entries[0];
      const renderedNestedValue = toDisplayValue(nestedValue, options);
      return `${key}: ${String(renderedNestedValue ?? "")}`;
    }

    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }

  return String(value);
};