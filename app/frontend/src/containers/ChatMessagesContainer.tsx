import { Box, CircularProgress, IconButton, Skeleton, Stack } from "@mui/material";
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import { Fragment, RefObject, useEffect, useRef, useState } from "react";
import { AlertBubble, AssistantBubble, UserBubble } from "../components";
import { isACompletion, isAMessage, isAToastMessage } from "../utils";

interface ChatMessagesContainerProps {
  chatHistory: ChatHistory;
  isLoading: boolean;
  chatMessageStreamEnd: RefObject<HTMLDivElement>;
  replayChat: () => void;
  handleRemoveToastMessage: (index: number) => void;
  handleBookReservation: (bookingDetails: BookingConfirmation) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  lastCompletionRef: React.RefObject<HTMLDivElement>;
  handleScroll: () => void;
  onScrollArrowClick: () => void;
  scrollable: boolean;
}

const ChatMessagesContainer = (props: ChatMessagesContainerProps) => {
  const {
    chatHistory,
    isLoading,
    chatMessageStreamEnd,
    replayChat,
    handleRemoveToastMessage,
    handleBookReservation,
    containerRef,
    lastCompletionRef,
    handleScroll,
    onScrollArrowClick,
    scrollable,
  } = props;

  const lastMsgRef = useRef<HTMLDivElement>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);

  // Show skeleton if generating but not yet streaming response
  useEffect(() => {
    setShowSkeleton(isLoading && !lastCompletionRef.current);
  }, [isLoading, lastCompletionRef.current]);

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        padding: "0.5rem",
        paddingBottom: 0,
        alignItems: "flex-end",
        overflowY: 'auto',
        margin: 'auto',
        width: "100%",
        height: "100%",
      }}
      aria-live="polite"
      aria-relevant="additions"
    >
      <Box sx={{ maxWidth: "lg", margin: "auto" }}>
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
            <Box sx={{ display: "flex", justifyContent: "center", my: "2rem" }}>
              <CircularProgress
                sx={{ "svg circle": { stroke: "url(#multicolor)" } }}
                size={50}
              />
            </Box>
          </>
        ) : (
          chatHistory.chatItems.map((chatItem, index) => (
            <Fragment key={index}>
              {isACompletion(chatItem) && chatItem.message.content && (
                <div
                  ref={
                    index === chatHistory.chatItems.length - 1
                      ? lastCompletionRef
                      : undefined
                  }>
                  <AssistantBubble
                    text={chatItem.message.content}
                    isLoading={
                      index === chatHistory.chatItems.length - 1 && isLoading
                    }
                    context={chatItem.message?.context}
                    toolsInfo={chatItem.message.tools_info}
                    replayChat={replayChat}
                    index={index}
                    total={chatHistory.chatItems.length}
                    handleBookReservation={handleBookReservation}
                  />
                </div>
              )}
              {isAMessage(chatItem) && (
                <div
                  ref={
                    index === chatHistory.chatItems.length - 1
                      ? lastMsgRef
                      : undefined
                  }>
                  <UserBubble
                    text={chatItem.content}
                    quote={chatItem.quotedText}
                    attachments={chatItem.attachments}
                  />
                </div>
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
        {showSkeleton && (
          <Stack direction="row" spacing={1} sx={{ my: 2, width: "100%", height: "200px" }}>
            <Skeleton variant="circular" height={35} width={35} />
            <Stack direction="column" alignItems="left" sx={{ width: "100%" }}>
              <Skeleton variant="text" width="85%" height={30} />
              <Skeleton variant="text" width="82%" height={30} />
              <Skeleton variant="text" width="88%" height={30} />
              <Skeleton variant="text" width="84%" height={30} />
              <Skeleton variant="text" width="87%" height={30} />
            </Stack>
          </Stack>
        )}
        {scrollable && (
          <IconButton
            onClick={onScrollArrowClick}
            sx={{
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              },
              position: "fixed",
              bottom: "11%",
              right: "40%",
              zIndex: 1200,
              height: "64px",
              width: "64px"
            }}
            aria-label={("scroll to bottom")}
          >
            <ArrowCircleDownIcon
              sx={{
                height: "40px",
                width: "40px"
              }}
              aria-label={("scroll to bottom")}
            />
          </IconButton>
        )}
        {/* {isLoading && !showSkeleton && (
        <div style={{ height: "200px" }} />
      )} */}
        {/* 
                We need this to be at the bottom so that we scroll PAST the last message. Otherwise,
                the last message will not be fully visible.
            */}
        <Box sx={{ mt: 5 }} ref={chatMessageStreamEnd} />
      </Box>
    </Box >
  );
};

export default ChatMessagesContainer;
