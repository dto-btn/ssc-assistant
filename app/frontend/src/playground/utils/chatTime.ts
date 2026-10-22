const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toValidDate = (value: unknown): Date | null => {
  if (
    typeof value !== "string" &&
    typeof value !== "number" &&
    !(value instanceof Date)
  ) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

export type ConversationBucket =
  | "today"
  | "yesterday"
  | "last7Days"
  | "last30Days"
  | "older";

export const CONVERSATION_BUCKET_LABEL_KEYS: Record<ConversationBucket, string> = {
  today: "sidebar.bucket.today",
  yesterday: "sidebar.bucket.yesterday",
  last7Days: "sidebar.bucket.last7Days",
  last30Days: "sidebar.bucket.last30Days",
  older: "sidebar.bucket.older",
};

export const getConversationBucket = (
  value: Date | number | string | null | undefined,
  now = new Date(),
): ConversationBucket => {
  const date = toValidDate(value);
  if (!date) return "older";

  const reference = toValidDate(now) ?? new Date();
  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const referenceDay = Date.UTC(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const diffDays = Math.round((referenceDay - dateDay) / MS_PER_DAY);

  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "yesterday";
  if (diffDays <= 7) return "last7Days";
  if (diffDays <= 30) return "last30Days";
  return "older";
};

export const formatConversationTimestamp = (
  value: Date | number,
  now = new Date(),
  locale?: string,
): string => {
  const date = value instanceof Date ? value : new Date(value);
  const options: Intl.DateTimeFormatOptions = {
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  };
  try {
    return new Intl.DateTimeFormat(locale, options).format(date);
  } catch {
    // Invalid language tags (e.g. i18next's "cimode") throw a RangeError.
    return new Intl.DateTimeFormat(undefined, options).format(date);
  }
};
