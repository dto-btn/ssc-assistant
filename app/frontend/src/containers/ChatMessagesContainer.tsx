import { Box, CircularProgress } from "@mui/material";
import { Fragment, RefObject } from "react";
import { AlertBubble, AssistantBubble, UserBubble } from "../components";
import { isACompletion, isAMessage, isAToastMessage } from "../utils";

interface ChatMessagesContainerProps {
    chatHistory: ChatHistory;
    isLoading: boolean;
    chatMessageStreamEnd: RefObject<HTMLDivElement>;
    replayChat: () => void;
    setIsFeedbackVisible: React.Dispatch<React.SetStateAction<boolean>>;
    setIsGoodResponse: React.Dispatch<React.SetStateAction<boolean>>;
    handleRemoveToastMessage: (index: number) => void;
}

const ChatMessagesContainer = (props: ChatMessagesContainerProps) => {
    const { chatHistory, isLoading, chatMessageStreamEnd, replayChat, 
        setIsFeedbackVisible, setIsGoodResponse, handleRemoveToastMessage } = props;
    
    return (
        <Box
            sx={{
            overflowY: "hidden",
            padding: "3rem",
            paddingTop: "6rem",
            alignItems: "flex-end",
            }}
            aria-live="polite" 
            aria-relevant='additions'
        >
            {!chatHistory?.chatItems ? (
                <>
                    <svg width={0} height={0}>
                        <defs>
                            <linearGradient id="multicolor" x1="0%" y1="0%" x2="0%" y2="100%">
                                <stop offset="0%" stopColor="#e01cd5" />
                                <stop offset="100%" stopColor="#1CB5E0" />
                            </linearGradient>
                        </defs>
                    </svg>
                    <Box sx={{ display: 'flex', justifyContent: 'center', my: '2rem' }}>
                        <CircularProgress sx={{ 'svg circle': { stroke: 'url(#multicolor)' } }} size={50} />
                    </Box>
                </>
            ) : (
                chatHistory.chatItems.map((chatItem, index) => (
                    <Fragment key={index}>
                        {isACompletion(chatItem) && chatItem.message.content && (
                            <AssistantBubble
                                text={chatItem.message.content}
                                isLoading={index === chatHistory.chatItems.length - 1 && isLoading}
                                context={chatItem.message?.context}
                                toolsInfo={chatItem.message.tools_info}
                                scrollRef={chatMessageStreamEnd}
                                replayChat={replayChat}
                                index={index}
                                total={chatHistory.chatItems.length}
                                setIsFeedbackVisible={setIsFeedbackVisible}
                                setIsGoodResponse={setIsGoodResponse}
                            />
                        )}
                        {isAMessage(chatItem) && (
                            <UserBubble text={chatItem.content} quote={chatItem.quotedText} />
                        )}
                        {isAToastMessage(chatItem) && (
                            <AlertBubble
                                toast={chatItem}
                                index={index}
                                removeMessageHandler={handleRemoveToastMessage}
                            />
                        )}
                    </Fragment>
                ))
            )}
        </Box>
    )
}

export default ChatMessagesContainer;