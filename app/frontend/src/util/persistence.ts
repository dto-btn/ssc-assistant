import { DisclaimerKey, DisclaimerState} from "../../types";
import { DEFAULT_CHAT_MODEL } from "../constants/models";

const cleanChatHistories = (histories: (Partial<ChatHistory> | null | undefined)[]) => {
    return histories.map((history, i) => {
        const fallbackDescription = "Conversation " + (i + 1);
        const defaultHistory = {
            chatItems: [],
            description: fallbackDescription,
            uuid: "",
            model: DEFAULT_CHAT_MODEL,
            employeeProfile: null,
            createdAt: new Date(),
            isTopicSet: false,
            staticTools: [],
        };

        if (!history) {
            return defaultHistory;
        }

        const candidate = history as Record<string, unknown>;

        const chatItems = Array.isArray(candidate.chatItems)
            ? candidate.chatItems as ChatItem[]
            : [];

        const staticTools = Array.isArray(candidate.staticTools)
            ? candidate.staticTools as string[]
            : [];

        const description = typeof candidate.description === "string" && candidate.description.trim().length > 0
            ? candidate.description
            : fallbackDescription;

        const model = typeof candidate.model === "string" && candidate.model.trim().length > 0
            ? candidate.model
            : DEFAULT_CHAT_MODEL;

        const uuid = typeof candidate.uuid === "string"
            ? candidate.uuid
            : "";

        let createdAt = defaultHistory.createdAt;
        if (candidate.createdAt) {
            const parsedDate = new Date(candidate.createdAt as string);
            if (!Number.isNaN(parsedDate.getTime())) {
                createdAt = parsedDate;
            }
        }

        const isTopicSet = typeof candidate.isTopicSet === "boolean"
            ? candidate.isTopicSet
            : false;

        return {
            ...defaultHistory,
            ...candidate,
            chatItems,
            staticTools,
            description,
            model,
            uuid,
            createdAt,
            isTopicSet,
        } as ChatHistory;
    });
};

export class PersistenceUtils {
    static getChatHistories(): (ChatHistory)[] {
        try {
            const histories = JSON.parse(
                localStorage.getItem("chatHistories") || "[]"
            ) as (ChatHistory | null)[];
            return cleanChatHistories(histories);
        } catch (e) {
            console.error("Error parsing chat histories from localStorage. Returning empty array.", e);
            return [];
        }
    }

    static setChatHistories(chatHistories: ChatHistory[]): void {
        localStorage.setItem("chatHistories", JSON.stringify(cleanChatHistories(chatHistories)));
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

    /**
     * Returns the state of disclaimers from localStorage. If the disclaimer is accepted, it will be set to true.
     * Otherwise, it will either be false or not present in the localStorage.
     */
    static getDisclaimerAcceptedState(): DisclaimerState {
        let obj = {} as DisclaimerState;
        try {
            obj = JSON.parse(localStorage.getItem("disclaimerState") || "{}");
        } catch (e) {
            console.error("Error parsing disclaimers from localStorage. Returning empty array.", e);
        }
        return obj;
    }

    static getIsDisclaimerAccepted(key: DisclaimerKey): boolean {
        const state = this.getDisclaimerAcceptedState();
        return !!state[key];
    }

    static setDisclaimerAccepted(key: DisclaimerKey): void {
        const state = this.getDisclaimerAcceptedState();
        state[key] = true;
        localStorage.setItem("disclaimerState", JSON.stringify(state));
    }

    static exportChatHistories(): void {
        try {
            const payload = {
                exportedAt: new Date().toISOString(),
                currentChatIndex: this.getCurrentChatIndex(),
                chatHistories: this.getChatHistories(),
            };
            const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
            const fileName = `ssc-assistant-chats-${timestamp}.json`;
            const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = fileName;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Failed to export chat histories.", error);
            throw error;
        }
    }

    static async importChatHistories(file: File): Promise<{ chatHistories: ChatHistory[]; currentChatIndex: number; exportedAt?: string }> {
        try {
            const fileContents = await file.text();
            const parsed = JSON.parse(fileContents) as {
                chatHistories?: (Partial<ChatHistory> | null)[];
                currentChatIndex?: number;
                exportedAt?: string;
            };

            if (!Array.isArray(parsed.chatHistories)) {
                throw new Error("Invalid chat export format");
            }

            const sanitizedHistories = cleanChatHistories(parsed.chatHistories);

            if (sanitizedHistories.length === 0) {
                throw new Error("Imported file does not contain any chat histories");
            }

            let currentChatIndexRaw: number | string | undefined = parsed.currentChatIndex;
            if (typeof currentChatIndexRaw !== "number") {
                const parsedIndex = parseInt(String(currentChatIndexRaw ?? "0"), 10);
                currentChatIndexRaw = Number.isNaN(parsedIndex) ? 0 : parsedIndex;
            }

            let currentChatIndex = currentChatIndexRaw as number;
            if (!Number.isInteger(currentChatIndex)) {
                currentChatIndex = 0;
            }

            if (currentChatIndex < 0) {
                currentChatIndex = 0;
            }
            if (currentChatIndex >= sanitizedHistories.length) {
                currentChatIndex = sanitizedHistories.length - 1;
            }

            this.setChatHistories(sanitizedHistories as ChatHistory[]);
            this.setCurrentChatIndex(currentChatIndex);

            return {
                chatHistories: sanitizedHistories as ChatHistory[],
                currentChatIndex,
                exportedAt: typeof parsed.exportedAt === "string" ? parsed.exportedAt : undefined,
            };
        } catch (error) {
            console.error("Failed to import chat histories.", error);
            throw error instanceof Error ? error : new Error("Failed to import chat histories");
        }
    }
}
