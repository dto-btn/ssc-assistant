export interface DisplayValueOptions {
  // Value returned when payload is null/undefined (e.g., null for DataGrid empty cells).
  nullValue?: string | number | null;
  // When true, { key: value } renders as "key: value" for compact single-field payloads.
  flattenSingleEntryObject?: boolean;
}

/**
 * Normalizes unknown payload values into render-safe primitives for table/card cells.
 * Keeps the return type limited to primitives React/DataGrid can render consistently.
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
    // Force empty items to "" during array flattening to avoid "null" string artifacts.
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