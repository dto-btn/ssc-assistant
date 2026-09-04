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

export const formatConversationBucket = (value: Date | number, now = new Date()): string => {
    const date = value instanceof Date ? value : new Date(value);
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dateStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const diffDays = Math.floor((todayStart - dateStart) / MS_PER_DAY);

    if (diffDays <= 0) {
        return "Today";
    }
    if (diffDays === 1) {
        return "Yesterday";
    }
    if (diffDays < 7) {
        return new Intl.DateTimeFormat(undefined, { weekday: "long" }).format(date);
    }
    if (diffDays < 14) {
        return "Last Week";
    }
    if (diffDays < 21) {
        return "2 Weeks";
    }
    if (diffDays < 28) {
        return "3 Weeks";
    }
    if (date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth()) {
        return "This Month";
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
