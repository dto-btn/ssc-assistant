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
    expect(
      SuggestionContextSchema.parse({ ...context, id: "saved-id" }),
    ).toEqual(context);
  });

  it.each([undefined, null, "not found"])(
    "accepts failure responses with reason %s",
    (reason) => {
      expect(
        SuggestionContextSchema.safeParse({ success: false, reason }).success,
      ).toBe(true);
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

  it("rejects malformed navigation hand-offs", () => {
    expect(
      SuggestionHandoffSchema.safeParse({
        handoffId: "handoff",
        success: true,
        context: { success: false },
      }).success,
    ).toBe(false);
    expect(
      SuggestionHandoffSchema.safeParse({
        handoffId: "",
        success: true,
        context,
      }).success,
    ).toBe(false);
  });
});
