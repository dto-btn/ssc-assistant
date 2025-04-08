export class PersistenceUtils {
    static getChatHistories(): ChatHistory[] {
        try {
            return JSON.parse(
                localStorage.getItem("chatHistories") || "[]"
            ) as ChatHistory[];
        } catch (e) {
            console.error("Error parsing chat histories from localStorage. Returning empty array.", e);
            return [];
        }
    }

    static setChatHistories(chatHistories: ChatHistory[]): void {
        localStorage.setItem("chatHistories", JSON.stringify(chatHistories));
    }

    static getCurrentChatIndex(): number {
        const index = parseInt(localStorage.getItem("currentChatIndex") || "0");
        return index;
    }

    static setCurrentChatIndex(index: number): void {
        localStorage.setItem("currentChatIndex", index.toString());
    }
}