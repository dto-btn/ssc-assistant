import { useRef, useMemo, useState } from "react";
import { isTokenExpired } from "../../util/token";
import { useMsal } from "@azure/msal-react";
import { apiUse } from "../../authConfig";
import { completionMySSC } from "../../api/api";
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
    const abortRef = useRef(false);

    const sendApiRequest = async (request: MessageRequest) => {
        abortRef.current = false; // Reset abort flag at start of request
        setIsLoading(true);

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

            await completionMySSC({
                request: request,
                updateLastMessage: (message_chunk: string) => {
                    // Only update if not aborted
                    if (!abortRef.current) {
                        chatService.updateLastMessage(message_chunk);
                    }
                },
                accessToken: token,
            });

            chatStore.setCurrentChatHistory((prevChatHistory) => {
                const updatedChatItems = prevChatHistory?.chatItems.map(
                    (item, itemIndex) => {
                        if (
                            itemIndex === prevChatHistory.chatItems.length - 1 &&
                            isACompletion(item) &&
                            !abortRequest
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
        }
    };

    const makeApiRequest = async (
        question: string,
        userData: { graphData: any },
        attachments?: Attachment[],
        quotedTextFromRegenerate?: string,
        enabledTools: Record<string, boolean> = {}
    ) => {
        abortRef.current = false; // Reset abort flag at start of request

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
        abortRef.current = true;
        // setAborted(true);

        // Append "You've stopped this response" to the last assistant message
        chatStore.setCurrentChatHistory((prevChatHistory) => {
            const chatItems = [...prevChatHistory.chatItems];
            if (chatItems.length === 0) return prevChatHistory;
            const lastIndex = chatItems.length - 1;
            const lastItem = chatItems[lastIndex];

            if (lastItem && lastItem.message && typeof lastItem.message.content === "string") {
                chatItems[lastIndex] = {
                    ...lastItem,
                    message: {
                        ...lastItem.message,
                        content: lastItem.message.content + "\n\nYou've stopped this response",
                    },
                };
            }
            const updatedChatHistory = {
                ...prevChatHistory,
                chatItems,
            };
            chatService.saveChatHistories(updatedChatHistory);
            return updatedChatHistory;
        });
    };

    const memoized = useMemo(() => ({
        makeApiRequest,
        isLoading,
        abortRequest,
    }), [isLoading, chatStore, chatService]);

    return memoized;
};