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
  "Today" | "Yesterday" | "Last 7 days" | "Last 30 days" | "Older";

export const formatConversationBucket = (
  value: Date | number | string | null | undefined,
  now = new Date(),
): ConversationBucket => {
  const date = toValidDate(value);
  if (!date) return "Older";

  const reference = toValidDate(now) ?? new Date();
  const dateDay = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  const referenceDay = Date.UTC(
    reference.getFullYear(),
    reference.getMonth(),
    reference.getDate(),
  );
  const diffDays = Math.round((referenceDay - dateDay) / MS_PER_DAY);

  if (diffDays <= 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays <= 7) return "Last 7 days";
  if (diffDays <= 30) return "Last 30 days";
  return "Older";
};

export const formatConversationTimestamp = (
  value: Date | number,
  now = new Date(),
): string => {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat(undefined, {
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
};
