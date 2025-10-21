import { DisclaimerKey, DisclaimerState} from "../../types";
import { DEFAULT_CHAT_MODEL } from "../constants/models";

const cleanChatHistories = (histories: (ChatHistory | null)[]) => {
    return histories.map((history, i) => {
        if (!history) {
            return {
                chatItems: [],
                description: "Conversation " + (i + 1),
                uuid: "",
                model: DEFAULT_CHAT_MODEL,
                employeeProfile: null,
                createdAt: new Date(),
                isTopicSet: false, // Default value for isTopicSet
                staticTools: [], // Default value for staticTools
            }
        } else {
            return history;
        }
    })
}

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
}