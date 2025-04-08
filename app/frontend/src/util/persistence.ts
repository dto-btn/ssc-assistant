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

    static setEnabledTools(enabledTools: Record<string, boolean>): void {
        localStorage.setItem("enabledTools", JSON.stringify(enabledTools));
    }

    static getEnabledTools(): Record<string, boolean> {
        try {
            return JSON.parse(localStorage.getItem("enabledTools") || "{}");
        } catch (e) {
            console.error("Error parsing enabled tools from localStorage. Returning empty object.", e);
            return {};
        }
    }

    static getSelectedCorporateFunction(): string | null {
        return localStorage.getItem("selectedCorporateFunction");
    }

    static setSelectedCorporateFunction(functionName: string) {
        localStorage.setItem("selectedCorporateFunction", functionName);
    }

    static clearSelectedCorporateFunction() {
        localStorage.setItem("selectedCorporateFunction", "none");
    }
}