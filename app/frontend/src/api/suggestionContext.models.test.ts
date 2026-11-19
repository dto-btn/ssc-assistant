import { describe, expect, it } from "vitest";
import {
  SuggestionContextSchema,
  SuggestionHandoffSchema,
} from "./suggestionContext.models";

const context = {
  success: true,
  language: "fr",
  original_query: "Question",
  timestamp: "2026-11-09T12:00:00.000Z",
  requester: "mysscplus",
  content: "Answer",
  citations: [{ title: "Source", url: "https://example.com/source" }],
};

describe("suggestion context validation", () => {
  it("accepts successful saved API responses with additional fields", () => {
    expect(SuggestionContextSchema.parse({ ...context, id: "saved-id" }))
      .toEqual(context);
  });

  it.each([undefined, null, "not found"])(
    "accepts failure responses with reason %s",
    (reason) => {
      expect(SuggestionContextSchema.safeParse({ success: false, reason }).success)
        .toBe(true);
    },
  );

  it.each([
    { ...context, language: "de" },
    { ...context, timestamp: "not a timestamp" },
    { ...context, citations: [{ title: "Missing URL" }] },
    { success: true },
    null,
  ])("rejects malformed responses", (value) => {
    expect(SuggestionContextSchema.safeParse(value).success).toBe(false);
  });

  it.each([
    "https://example.com/source",
    "HTTP://example.com/source",
    "/pmcoe/source",
  ])("accepts safe citation URL %s", (url) => {
    expect(SuggestionContextSchema.safeParse({
      ...context,
      citations: [{ title: "Source", url }],
    }).success).toBe(true);
  });

  it.each([
    "javascript:alert(1)",
    "JaVaScRiPt:alert(1)",
    "java\tscript:alert(1)",
    "data:text/html,hello",
    "//example.com/source",
    "/\\example.com/source",
    "https://",
  ])("rejects unsafe citation URL %s", (url) => {
    const unsafeContext = { ...context, citations: [{ title: "Source", url }] };
    expect(SuggestionContextSchema.safeParse(unsafeContext).success).toBe(false);
    expect(SuggestionHandoffSchema.safeParse({
      handoffId: "handoff",
      success: true,
      context: unsafeContext,
    }).success).toBe(false);
  });

  it("rejects malformed navigation hand-offs", () => {
    expect(SuggestionHandoffSchema.safeParse({
      handoffId: "handoff",
      success: true,
      context: { success: false },
    }).success).toBe(false);
    expect(SuggestionHandoffSchema.safeParse({
      handoffId: "",
      success: true,
      context,
    }).success).toBe(false);
  });
});
