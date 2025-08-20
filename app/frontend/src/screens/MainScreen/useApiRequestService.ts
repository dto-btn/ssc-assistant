import { useMemo, useState, useCallback, useRef } from "react"
import { isTokenExpired } from "../../util/token";
import { useMsal } from "@azure/msal-react";
import { apiUse } from "../../authConfig";
import { completionBasic, completion } from "../../api/api";
import { AccountInfo } from "@azure/msal-browser";
import { useChatService } from "../../hooks/useChatService";
import { useTranslation } from "react-i18next";
import { useChatStore } from "../../stores/ChatStore";
import { isACompletion, isAToastMessage } from "../../utils";
import { convertChatHistoryToMessages } from "./utils";
import { MAX_MESSAGES_SENT } from "../../constants";


export const useApiRequestService = () => {
    const { instance } = useMsal();
    const [apiAccessToken, setApiAccessToken] = useState<string>("");
    const chatService = useChatService();
    const { t, i18n } = useTranslation();
    const chatStore = useChatStore();
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const abortControllerRef = useRef<AbortController | null>(null);

    const sendApiRequest = async (request: MessageRequest) => {
        try {
            let token = apiAccessToken;
            if (!apiAccessToken || isTokenExpired(apiAccessToken)) {
                const response = await instance.acquireTokenSilent({
                    ...apiUse,
                    account: instance.getActiveAccount() as AccountInfo,
                    forceRefresh: true,
                });
                setApiAccessToken(response.accessToken);
                token = response.accessToken;
            }

            if (!token) throw new Error(t("no.token"));

            abortControllerRef.current = new AbortController();

            const completionResponse = await completion({
                request: request,
                updateLastMessage: chatService.updateLastMessage,
                accessToken: token,
                signal: abortControllerRef.current.signal,
            });

            chatStore.setCurrentChatHistory((prevChatHistory) => {
                const updatedChatItems = prevChatHistory?.chatItems.map(
                    (item, itemIndex) => {
                        if (
                            itemIndex === prevChatHistory.chatItems.length - 1 &&
                            isACompletion(item)
                        ) {
                            return {
                                ...item,
                                message: {
                                    ...item.message,
                                    context: completionResponse.message.context,
                                    tools_info: completionResponse.message.tools_info,
                                },
                            };
                        }
                        return item;
                    }
                );

                const updatedChatHistory: ChatHistory = {
                    ...prevChatHistory,
                    chatItems: updatedChatItems,
                };

                // filters toast messages so they're not saved to local storage
                const filteredChatHistory = {
                    ...updatedChatHistory,
                    chatItems: updatedChatItems.filter((item) => !isAToastMessage(item)),
                };

                chatService.saveChatHistories(filteredChatHistory);
                return updatedChatHistory;
            });
        } catch (error) {
            let errorMessage: string;

            if (error instanceof Error) {
                if (error.name === "AbortError") {
                    setIsLoading(false); // Ensure loading state is reset
                    return; // Exit if the request was aborted
                }
                errorMessage = error.message;
            } else {
                errorMessage = t("chat.unknownError");
            }

            const toast: ToastMessage = {
                toastMessage: errorMessage,
                isError: true,
            };

            chatStore.setCurrentChatHistory((prevChatHistory) => {
                const updatedChatHistory = {
                    ...prevChatHistory,
                    chatItems: [...prevChatHistory.chatItems, toast],
                };
                return updatedChatHistory;
            });
        } finally {
            setIsLoading(false);
            abortControllerRef.current = null;
        }
    };

    const makeApiRequest = async (
        question: string,
        userData: { graphData: any },
        attachments?: Attachment[],
        quotedTextFromRegenerate?: string,
        enabledTools: Record<string, boolean> = {}
    ) => {
        // set is loading so we disable some interactive functionality while we load the response
        setIsLoading(true);
        const messagedQuoted = quotedTextFromRegenerate
            ? quotedTextFromRegenerate
            : chatStore.quotedText;

        const userMessage: Message = {
            role: "user",
            content: question,
            quotedText: messagedQuoted,
            attachments: attachments,
        };

        const responsePlaceholder: Completion = {
            message: {
                role: "assistant",
                content: "",
            },
        };

        const messages = convertChatHistoryToMessages([
            ...chatStore.getCurrentChatHistory().chatItems,
            userMessage,
        ], MAX_MESSAGES_SENT);

        // prepare request bundle
        const request: MessageRequest = {
            messages: messages,
            max: MAX_MESSAGES_SENT,
            top: 5, // actually unused in the API, fyi.. needs refactor
            tools: Object.keys(enabledTools).filter((key) => enabledTools[key]),
            uuid: chatStore.getCurrentChatHistory().uuid,
            quotedText: messagedQuoted,
            model: chatStore.getCurrentChatHistory().model,
            lang: i18n.language, // Pass current language preference
            fullName:
                userData.graphData["givenName"] + " " + userData.graphData["surname"],
        };

        // update current chat window with the message sent..
        chatStore.setCurrentChatHistory((prevChatHistory) => {
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems: [
                    ...prevChatHistory.chatItems,
                    userMessage,
                    responsePlaceholder,
                ],
            };
            chatService.saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });

        sendApiRequest(request);
        chatStore.quotedText = undefined
    };

    const abortRequest = () => {
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
            abortControllerRef.current = null;
        }
    };

    const memoized = useMemo(() => {
        return {
            makeApiRequest,
            isLoading,
            abortRequest,
        }
    }, [isLoading, chatStore, chatService]);

    return memoized;
}


export const useBasicApiRequestService = () => {
    const { instance } = useMsal(); // MSAL instance for token operations
    const [apiAccessToken, setApiAccessToken] = useState<string>(""); // Manage access token state

    // Function to perform the API request
    const makeBasicApiRequest = useCallback(async (request: MessageRequest) => {
        try {
            // Check if the access token is expired or missing; refresh if needed
            let token = apiAccessToken;

            if (!apiAccessToken || isTokenExpired(apiAccessToken)) {
                const response = await instance.acquireTokenSilent({
                    ...apiUse,
                    account: instance.getActiveAccount() as AccountInfo,
                    forceRefresh: true, // Force token refresh
                });

                setApiAccessToken(response.accessToken); // Update token state
                token = response.accessToken; // Use the refreshed token
            }

            // Ensure token is available
            if (!token) throw new Error("No API access token available");

            // Make the API call with the provided request and token
            const completeBasisResponse = await completionBasic(request, token);

            // Return the API response
            return completeBasisResponse;
        } catch (error) {
            console.error("Error in makeBasicApiRequest:", error);
            throw error; // Re-throw error to be handled by the caller
        }
    }, [apiAccessToken, instance]); // Dependencies for the function

    return makeBasicApiRequest; // Return the function for use in components/services
};