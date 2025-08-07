import { Box, CircularProgress, Skeleton } from "@mui/material";
import { Fragment, RefObject, useEffect, useState, useRef } from "react";
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
  handleScroll: () => void;
  isTailing: boolean;
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
    handleScroll,
    isTailing,
  } = props;

  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const [skeletonHeight, setSkeletonHeight] = useState(200);
  const [skeletonColour, setSkeletonColor] = useState("gray.900");

  useEffect(() => {
    var lastCompletion = chatHistory.chatItems[chatHistory.chatItems.length - 1] as Completion;

    console.log(lastCompletion.message.content === "")

    if (lastCompletion && lastCompletion.message && typeof lastCompletion.message.content === "string" && isLoading) {
      if (!completionRef.current && lastUserMessageRef.current && containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const messageHeight = lastUserMessageRef.current.clientHeight;
        setSkeletonHeight(containerHeight - messageHeight - 60);
        // setSkeletonColor("grey.300");
        console.log("Container height:", containerHeight, "Message height:", messageHeight);
        if (isTailing) {
          setTimeout(() => {
            containerRef.current?.scrollTo({
              top: containerRef.current.scrollHeight,
              behavior: "smooth",
            });
          }, 100);
        }
      }
      else if (completionRef.current && lastUserMessageRef.current && containerRef.current) {
        const containerHeight = containerRef.current.clientHeight;
        const messageHeight = lastUserMessageRef.current.clientHeight;
        const completionHeight = completionRef.current.clientHeight;

        setSkeletonHeight(0);

        // if (completionHeight > (containerHeight - messageHeight - 60)) {
        //   setSkeletonHeight(0);
        //   console.log("Completion height is greater than container height minus message height, setting skeleton height to 0");
        // }
        // else {
        //   setSkeletonHeight(containerHeight - messageHeight - completionHeight - 60);
        //   setSkeletonColor("#F5F5F5");
        //   console.log("Container height:", containerHeight, "Message height:", messageHeight, "Completion height:", completionHeight);
        // }
      }
    }

    console.log("Skeleton height set to:", skeletonHeight);
  }, [chatHistory.chatItems, isLoading]);

  return (
    <Box
      ref={containerRef}
      onScroll={handleScroll}
      sx={{
        height: "100%",
        overflowY: "auto",
        padding: "0.5rem",
        paddingBottom: 0,
        alignItems: "flex-end",
        width: "100%",
      }}
      aria-live="polite"
      aria-relevant="additions"
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
                    ? completionRef
                    : undefined
                }
              >
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
                  index === chatHistory.chatItems.length - 2
                    ? lastUserMessageRef
                    : undefined
                }
              >
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
      {isLoading && (
        <Skeleton
          variant="text"
          width="85%"
          height={`${skeletonHeight}px`}
        // sx={{ ml: "4%", bgcolor: skeletonColour }}
        />
      )}
      {/* 
        We need this to be at the bottom so that we scroll PAST the last message. 
        Otherwise, the last message will not be fully visible.
      */}
      <Box sx={{ mt: 5 }} ref={chatMessageStreamEnd} />
    </Box>
  );
};

export default ChatMessagesContainer;
