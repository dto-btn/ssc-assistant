import { describe, expect, it } from "vitest";
import { toDisplayValue } from "./displayValue";

describe("toDisplayValue", () => {
  it("returns strings and numbers unchanged", () => {
    expect(toDisplayValue("alpha")).toBe("alpha");
    expect(toDisplayValue(42)).toBe(42);
  });

  it("renders booleans and null-like values safely", () => {
    expect(toDisplayValue(true)).toBe("true");
    expect(toDisplayValue(false)).toBe("false");
    expect(toDisplayValue(null)).toBe("");
    expect(toDisplayValue(undefined, { nullValue: null })).toBeNull();
  });

  it("flattens arrays recursively into comma-separated values", () => {
    expect(toDisplayValue(["one", 2, true, null])).toBe("one, 2, true, ");
  });

  it("flattens single-entry objects by default", () => {
    expect(toDisplayValue({ label: "alpha" })).toBe("label: alpha");
  });

  it("can preserve object JSON when single-entry flattening is disabled", () => {
    expect(
      toDisplayValue(
        { label: "alpha" },
        { flattenSingleEntryObject: false },
      ),
    ).toBe('{"label":"alpha"}');
  });

  it("serializes multi-key objects as JSON", () => {
    expect(toDisplayValue({ a: 1, b: 2 })).toBe('{"a":1,"b":2}');
  });
});
