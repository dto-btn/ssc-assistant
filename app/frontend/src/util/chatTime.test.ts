import { describe, expect, it } from "vitest";

import { formatConversationBucket } from "./chatTime";

// Mid-afternoon so that +/- a few hours never rolls into an adjacent day by accident.
const NOW = new Date(2026, 8, 9, 14, 30);

const daysBefore = (days: number, hour = 14, minute = 30) =>
  new Date(2026, 8, 9 - days, hour, minute);

describe("formatConversationBucket", () => {
  it("buckets the same calendar day as Today", () => {
    expect(formatConversationBucket(NOW, NOW)).toBe("Today");
    expect(formatConversationBucket(daysBefore(0, 0, 0), NOW)).toBe("Today");
    expect(formatConversationBucket(daysBefore(0, 23, 59), NOW)).toBe("Today");
  });

  it("buckets the previous calendar day as Yesterday", () => {
    expect(formatConversationBucket(daysBefore(1), NOW)).toBe("Yesterday");
    expect(formatConversationBucket(daysBefore(1, 0, 0), NOW)).toBe("Yesterday");
    expect(formatConversationBucket(daysBefore(1, 23, 59), NOW)).toBe("Yesterday");
  });

  it("uses calendar days, not elapsed hours, at the midnight boundary", () => {
    // 31 minutes earlier but a different calendar day.
    const justBeforeMidnight = new Date(2026, 8, 8, 23, 59);
    const justAfterMidnight = new Date(2026, 8, 9, 0, 1);

    expect(formatConversationBucket(justBeforeMidnight, justAfterMidnight)).toBe("Yesterday");
    // Nearly 24h earlier but still the same calendar day.
    expect(formatConversationBucket(justAfterMidnight, new Date(2026, 8, 9, 23, 59))).toBe("Today");
  });

  it("buckets 2 through 7 days back as Last 7 days", () => {
    for (const days of [2, 3, 5, 6, 7]) {
      expect(formatConversationBucket(daysBefore(days), NOW)).toBe("Last 7 days");
    }
  });

  it("buckets 8 through 30 days back as Last 30 days", () => {
    for (const days of [8, 15, 29, 30]) {
      expect(formatConversationBucket(daysBefore(days), NOW)).toBe("Last 30 days");
    }
  });

  it("buckets anything older than 30 days as Older", () => {
    for (const days of [31, 60, 400]) {
      expect(formatConversationBucket(daysBefore(days), NOW)).toBe("Older");
    }
  });

  it("keeps each boundary on the expected side", () => {
    expect(formatConversationBucket(daysBefore(7), NOW)).toBe("Last 7 days");
    expect(formatConversationBucket(daysBefore(8), NOW)).toBe("Last 30 days");
    expect(formatConversationBucket(daysBefore(30), NOW)).toBe("Last 30 days");
    expect(formatConversationBucket(daysBefore(31), NOW)).toBe("Older");
  });

  it("treats future timestamps as Today so clock skew cannot produce a stale bucket", () => {
    expect(formatConversationBucket(new Date(2026, 8, 10), NOW)).toBe("Today");
    expect(formatConversationBucket(new Date(2027, 0, 1), NOW)).toBe("Today");
  });

  it("accepts epoch milliseconds and ISO strings", () => {
    expect(formatConversationBucket(daysBefore(1).getTime(), NOW)).toBe("Yesterday");
    expect(formatConversationBucket(daysBefore(3).toISOString(), NOW)).toBe("Last 7 days");
  });

  it("falls back to Older for missing or unparseable values", () => {
    expect(formatConversationBucket(null, NOW)).toBe("Older");
    expect(formatConversationBucket(undefined, NOW)).toBe("Older");
    expect(formatConversationBucket("not a date", NOW)).toBe("Older");
    expect(formatConversationBucket(Number.NaN, NOW)).toBe("Older");
  });

  it("spans a month boundary without drifting", () => {
    const firstOfMonth = new Date(2026, 8, 1, 9, 0);
    expect(formatConversationBucket(new Date(2026, 7, 31, 23, 0), firstOfMonth)).toBe("Yesterday");
    expect(formatConversationBucket(new Date(2026, 7, 25, 9, 0), firstOfMonth)).toBe("Last 7 days");
  });

  it("spans a year boundary without drifting", () => {
    const newYearsDay = new Date(2026, 0, 1, 9, 0);
    expect(formatConversationBucket(new Date(2025, 11, 31, 23, 0), newYearsDay)).toBe("Yesterday");
    expect(formatConversationBucket(new Date(2025, 11, 20, 9, 0), newYearsDay)).toBe("Last 30 days");
  });

  it("counts calendar days across a DST transition", () => {
    // In DST-observing zones these local midnights are only 23h apart; the bucket must still be Yesterday.
    const dayAfterSpringForward = new Date(2026, 2, 9, 10, 0);
    expect(formatConversationBucket(new Date(2026, 2, 8, 10, 0), dayAfterSpringForward)).toBe("Yesterday");

    const dayAfterFallBack = new Date(2026, 10, 2, 10, 0);
    expect(formatConversationBucket(new Date(2026, 10, 1, 10, 0), dayAfterFallBack)).toBe("Yesterday");
  });
});
