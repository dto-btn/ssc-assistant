import { isACompletion, isAMessage } from "../utils";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const toValidDate = (value: unknown): Date | null => {
    if (typeof value !== "string" && typeof value !== "number" && !(value instanceof Date)) {
        return null;
    }

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

export const getChatItemDate = (chatItem: ChatItem, fallback?: unknown): Date | null => {
    if (isACompletion(chatItem)) {
        return toValidDate(chatItem.createdAt) || toValidDate(chatItem.message?.createdAt) || toValidDate(fallback);
    }

    if (isAMessage(chatItem)) {
        return toValidDate(chatItem.createdAt) || toValidDate(fallback);
    }

    return toValidDate(fallback);
};

export const getChatLastActivityDate = (chatHistory: ChatHistory): Date => {
    for (let index = chatHistory.chatItems.length - 1; index >= 0; index -= 1) {
        const date = getChatItemDate(chatHistory.chatItems[index]);
        if (date) {
            return date;
        }
    }

    return toValidDate(chatHistory.updatedAt) || toValidDate(chatHistory.createdAt) || new Date(0);
};

export const sortChatsByLastActivity = (chatHistories: ChatHistory[]): ChatHistory[] => {
    return [...chatHistories].sort((a, b) => getChatLastActivityDate(b).getTime() - getChatLastActivityDate(a).getTime());
};

export type ConversationBucket =
  | "Today"
  | "Yesterday"
  | "Last 7 days"
  | "Last 30 days"
  | "Older";

// Counts calendar days via UTC-normalized local Y/M/D so DST shifts never skew the diff.
const calendarDaysBetween = (from: Date, to: Date): number => {
  const fromDay = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
  const toDay = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((toDay - fromDay) / MS_PER_DAY);
};

export const formatConversationBucket = (
  value: Date | number | string | null | undefined,
  now = new Date()
): ConversationBucket => {
  const date = toValidDate(value);
  if (!date) {
    return "Older";
  }

  const reference = toValidDate(now) ?? new Date();
  const diffDays = calendarDaysBetween(date, reference);

  // Clock skew or a future timestamp still reads as the most recent bucket.
  if (diffDays <= 0) {
    return "Today";
  }

  if (diffDays === 1) {
    return "Yesterday";
  }

  if (diffDays <= 7) {
    return "Last 7 days";
  }

  if (diffDays <= 30) {
    return "Last 30 days";
  }

  return "Older";
};


export const formatConversationTimestamp = (value: Date | number): string => {
    const date = value instanceof Date ? value : new Date(value);
    return new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    }).format(date);
};

export const shouldShowMessageTimestamp = (
    currentDate: Date | null,
    previousDate: Date | null,
): currentDate is Date => {
    if (!currentDate) {
        return false;
    }
    if (!previousDate) {
        return true;
    }

    const currentDay = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
    const previousDay = new Date(previousDate.getFullYear(), previousDate.getMonth(), previousDate.getDate()).getTime();
    const gap = currentDate.getTime() - previousDate.getTime();

    return currentDay !== previousDay || gap >= 60 * 60 * 1000;
};
