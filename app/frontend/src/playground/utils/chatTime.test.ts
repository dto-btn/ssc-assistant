import { describe, expect, it } from "vitest";

import {
  CONVERSATION_BUCKET_LABEL_KEYS,
  getConversationBucket,
  formatConversationTimestamp,
} from "./chatTime";
import translations from "../locales/translations.json";

const NOW = new Date(2026, 8, 9, 14, 30);

const daysBefore = (days: number, hour = 14, minute = 30) =>
  new Date(2026, 8, 9 - days, hour, minute);

describe("formatConversationTimestamp", () => {
  it("omits the year for timestamps in the current year", () => {
    expect(formatConversationTimestamp(NOW, NOW)).toBe(
      new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(NOW),
    );
  });

  it("includes the year for timestamps outside the current year", () => {
    for (const year of [2025, 2027]) {
      const date = new Date(year, 8, 9, 14, 30);
      expect(formatConversationTimestamp(date.getTime(), NOW)).toBe(
        new Intl.DateTimeFormat(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }).format(date),
      );
    }
  });

  it("formats using the provided locale", () => {
    expect(formatConversationTimestamp(NOW, NOW, "fr")).toBe(
      new Intl.DateTimeFormat("fr", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }).format(NOW),
    );
  });
});

describe("CONVERSATION_BUCKET_LABEL_KEYS", () => {
  it("maps every bucket to a key translated in English and French", () => {
    const entries = translations as Record<string, { en?: string; fr?: string }>;
    Object.values(CONVERSATION_BUCKET_LABEL_KEYS).forEach((key) => {
      expect(entries[key]?.en).toBeTruthy();
      expect(entries[key]?.fr).toBeTruthy();
    });
  });
});

describe("getConversationBucket", () => {
  it("buckets the same calendar day as Today", () => {
    expect(getConversationBucket(NOW, NOW)).toBe("today");
    expect(getConversationBucket(daysBefore(0, 0, 0), NOW)).toBe("today");
    expect(getConversationBucket(daysBefore(0, 23, 59), NOW)).toBe("today");
  });

  it("buckets the previous calendar day as Yesterday", () => {
    expect(getConversationBucket(daysBefore(1), NOW)).toBe("yesterday");
    expect(getConversationBucket(daysBefore(1, 0, 0), NOW)).toBe(
      "yesterday",
    );
    expect(getConversationBucket(daysBefore(1, 23, 59), NOW)).toBe(
      "yesterday",
    );
  });

  it("uses calendar days, not elapsed hours, at the midnight boundary", () => {
    const justBeforeMidnight = new Date(2026, 8, 8, 23, 59);
    const justAfterMidnight = new Date(2026, 8, 9, 0, 1);

    expect(
      getConversationBucket(justBeforeMidnight, justAfterMidnight),
    ).toBe("yesterday");
    expect(
      getConversationBucket(justAfterMidnight, new Date(2026, 8, 9, 23, 59)),
    ).toBe("today");
  });

  it("buckets 2 through 7 days back as Last 7 days", () => {
    for (const days of [2, 3, 5, 6, 7]) {
      expect(getConversationBucket(daysBefore(days), NOW)).toBe(
        "last7Days",
      );
    }
  });

  it("buckets 8 through 30 days back as Last 30 days", () => {
    for (const days of [8, 15, 29, 30]) {
      expect(getConversationBucket(daysBefore(days), NOW)).toBe(
        "last30Days",
      );
    }
  });

  it("buckets anything older than 30 days as Older", () => {
    for (const days of [31, 60, 400]) {
      expect(getConversationBucket(daysBefore(days), NOW)).toBe("older");
    }
  });

  it("keeps each boundary on the expected side", () => {
    expect(getConversationBucket(daysBefore(7), NOW)).toBe("last7Days");
    expect(getConversationBucket(daysBefore(8), NOW)).toBe("last30Days");
    expect(getConversationBucket(daysBefore(30), NOW)).toBe("last30Days");
    expect(getConversationBucket(daysBefore(31), NOW)).toBe("older");
  });

  it("treats future timestamps as Today so clock skew cannot produce a stale bucket", () => {
    expect(getConversationBucket(new Date(2026, 8, 10), NOW)).toBe("today");
    expect(getConversationBucket(new Date(2027, 0, 1), NOW)).toBe("today");
  });

  it("accepts epoch milliseconds and ISO strings", () => {
    expect(getConversationBucket(daysBefore(1).getTime(), NOW)).toBe(
      "yesterday",
    );
    expect(getConversationBucket(daysBefore(3).toISOString(), NOW)).toBe(
      "last7Days",
    );
  });

  it("falls back to Older for missing or unparsable values", () => {
    expect(getConversationBucket(null, NOW)).toBe("older");
    expect(getConversationBucket(undefined, NOW)).toBe("older");
    expect(getConversationBucket("not a date", NOW)).toBe("older");
    expect(getConversationBucket(Number.NaN, NOW)).toBe("older");
  });

  it("spans a month boundary without drifting", () => {
    const firstOfMonth = new Date(2026, 8, 1, 9, 0);
    expect(
      getConversationBucket(new Date(2026, 7, 31, 23, 0), firstOfMonth),
    ).toBe("yesterday");
    expect(
      getConversationBucket(new Date(2026, 7, 25, 9, 0), firstOfMonth),
    ).toBe("last7Days");
  });

  it("spans a year boundary without drifting", () => {
    const newYearsDay = new Date(2026, 0, 1, 9, 0);
    expect(
      getConversationBucket(new Date(2025, 11, 31, 23, 0), newYearsDay),
    ).toBe("yesterday");
    expect(
      getConversationBucket(new Date(2025, 11, 20, 9, 0), newYearsDay),
    ).toBe("last30Days");
  });

  it("counts calendar days across a DST transition", () => {
    const dayAfterSpringForward = new Date(2026, 2, 9, 10, 0);
    expect(
      getConversationBucket(
        new Date(2026, 2, 8, 10, 0),
        dayAfterSpringForward,
      ),
    ).toBe("yesterday");

    const dayAfterFallBack = new Date(2026, 10, 2, 10, 0);
    expect(
      getConversationBucket(new Date(2026, 10, 1, 10, 0), dayAfterFallBack),
    ).toBe("yesterday");
  });
});
