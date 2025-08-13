import { Box, CircularProgress, IconButton, Skeleton, Stack } from "@mui/material";
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
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
    handleScroll,
    onScrollArrowClick,
    scrollable,
  } = props;

  const lastUserMessageRef = useRef<HTMLDivElement>(null);
  const completionRef = useRef<HTMLDivElement>(null);
  const [skeletonHeight, setSkeletonHeight] = useState<string>("20%");
  const [showSkeleton, setShowSkeleton] = useState<boolean>(false);

  // Effect to handle the height of the skeleton when a question is asked
  useEffect(() => {
    handleScroll(); // Update scrollable state on new messages

    var lastCompletion = chatHistory.chatItems[chatHistory.chatItems.length - 1] as Completion;

    // If the last item is a completion and it has content, we calculate the skeleton height
    if (lastCompletion && lastCompletion.message && typeof lastCompletion.message.content === "string" && isLoading) {
      // If the completion is not yet rendered, we calculate the height based on the container and last user message
      if (!completionRef.current && lastUserMessageRef.current && containerRef.current) {

        const containerHeight = containerRef.current.clientHeight;
        const messageHeight = lastUserMessageRef.current.clientHeight;

        // Calculate skeleton height as a percentage based on the container and message heights with an offset
        const heightPercent = ((containerHeight - messageHeight) / containerHeight) * 75;

        setSkeletonHeight(`${heightPercent}%`);
        setShowSkeleton(true);

        // Scroll to the bottom if we are tailing (Pushes question to the top)
        setTimeout(() => {
          containerRef.current?.scrollTo({
            top: containerRef.current.scrollHeight,
            behavior: "smooth",
          });
        }, 100);
      }
      else if (completionRef.current && lastUserMessageRef.current && containerRef.current) {

        // If the completion is shorter than the container, calucate the height based on the completion, container & question
        if (completionRef.current.clientHeight < containerRef.current.clientHeight) {
          const containerHeight = containerRef.current.clientHeight;
          const messageHeight = lastUserMessageRef.current.clientHeight;
          const completionHeight = completionRef.current.clientHeight;

          // Calculate skeleton height as a percentage based on the container and message heights with an offset
          const heightPercent = ((containerHeight - messageHeight - completionHeight) / containerHeight) * 75;

          setSkeletonHeight(`${heightPercent}%`);

          // If the completion is being rendered, hide skeleton
          setShowSkeleton(false);
        }
        else { // If the completion is already rendered, set the skeleton height to 0%
          setSkeletonHeight("0%");
        }
      }
    }
    else if (!isLoading && completionRef.current && lastUserMessageRef.current && containerRef.current) {
      // If rendered, then make sure that there is no white space for completions that are longer than the screen
      if (completionRef.current.clientHeight > containerRef.current.clientHeight) {
        setSkeletonHeight("0%");
      }
    }
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
      <div style={{ height: skeletonHeight, width: "90%", display: "flex", alignItems: "center", marginLeft: "1%" }}>
        {showSkeleton && (
          <>
            <Skeleton
              variant="circular"
              height="35px"
              width="35px"
              sx={{ position: "relative", top: "-23%" }}
            />
            <Stack direction="column" sx={{ position: "relative", top: "20%", height: "100%", width: "95%" }}>
              <Skeleton
                variant="text"
                width="85%"
                height="30px"
                sx={{ ml: "1%" }}
              />
              <Skeleton
                variant="text"
                width="82%"
                height="30px"
                sx={{ ml: "1%" }}
              />
              <Skeleton
                variant="text"
                width="88%"
                height="30px"
                sx={{ ml: "1%" }}
              />
              <Skeleton
                variant="text"
                width="84%"
                height="30px"
                sx={{ ml: "1%" }}
              />
              <Skeleton
                variant="text"
                width="87%"
                height="30px"
                sx={{ ml: "1%" }}
              />
            </Stack>
          </>
        )}
      </div>
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
      {/* 
        We need this to be at the bottom so that we scroll PAST the last message. 
        Otherwise, the last message will not be fully visible.
      */}
      <Box sx={{ mt: 5 }} ref={chatMessageStreamEnd} />
    </Box>
  );
};

export default ChatMessagesContainer;
