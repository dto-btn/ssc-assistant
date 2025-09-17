import { Box, CircularProgress, IconButton, Skeleton, Stack } from "@mui/material";
import ArrowCircleDownIcon from '@mui/icons-material/ArrowCircleDown';
import { Fragment, useEffect, useRef, useState } from "react";
import { AlertBubble, AssistantBubble, UserBubble } from "../components";
import { isACompletion, isAMessage, isAToastMessage } from "../utils";
import { useTranslation } from "react-i18next";

const SKELETON_HEIGHT = 200;

interface ChatMessagesContainerProps {
  chatHistory: ChatHistory;
  isLoading: boolean;
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
    replayChat,
    handleRemoveToastMessage,
    handleBookReservation,
    containerRef,
    lastCompletionRef,
    handleScroll,
    onScrollArrowClick,
    scrollable,
  } = props;

  const { t } = useTranslation();

  const lastMsgRef = useRef<HTMLDivElement>(null);
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [whitespace, setWhitespace] = useState("0px");
  const [replaying, setReplaying] = useState(false);

  // Show skeleton if generating but not yet streaming response
  useEffect(() => {
    const chatRef = containerRef.current;
    const messageRef = lastMsgRef.current;
    const completionRef = lastCompletionRef.current;

    // Hide or show skeleton & change whitespace based on completion stage
    if (isLoading && !completionRef && messageRef && chatRef) { // Completion hasn't started streaming yet

      setShowSkeleton(true);

      // Don't adjust whitespace for first question & answer
      if (chatHistory.chatItems.length <= 2) {
        return;
      }

      // Calculate the message and skeleton height as a fraction of the container height
      const messageFraction = messageRef.offsetHeight / chatRef.clientHeight;
      const skeletonFraction = SKELETON_HEIGHT / chatRef.clientHeight;

      // Subtract the fractions from 1 to get the remaining space as a fraction
      const whiteSpaceFraction = 1 - messageFraction - skeletonFraction;

      // Ensure the fraction is not negative
      const whiteSpaceHeight = Math.max(whiteSpaceFraction * chatRef.clientHeight, 0);

      if (replaying) {
        setWhitespace(`${whiteSpaceHeight * 0.92}px`);
      }
      else {
        setWhitespace(`${whiteSpaceHeight * 0.95}px`);
      }

      // Scroll to push message to the top
      setTimeout(() => {
        chatRef.scrollTo({
          top: chatRef.scrollHeight,
          behavior: "smooth"
        });
      }, 1000);
    }
    else if (isLoading && completionRef && messageRef && chatRef) { // Completion/Replay has started rendering

      setShowSkeleton(false);

      // Don't adjust whitespace for first question & answer
      if (chatHistory.chatItems.length <= 2) {
        return;
      }

      // Calculate the message and completion height as a fraction of the container height
      const messageFraction = messageRef.offsetHeight / chatRef.clientHeight;
      const completionFraction = completionRef.offsetHeight / chatRef.clientHeight;

      // Subtract the fractions from 1 to get the remaining space as a fraction
      const whiteSpaceFraction = 1 - messageFraction - completionFraction;

      // Ensure the fraction is not negative
      const whiteSpaceHeight = Math.max(whiteSpaceFraction * chatRef.clientHeight, 0);
      setWhitespace(`${whiteSpaceHeight}px`);

      // Check if page is scrollable to show arrow button as completion streams
      handleScroll();

    }
    else { // Completion/Replay Finished

      setShowSkeleton(false);
      setReplaying(false);

    }

  }, [isLoading, chatHistory.chatItems]);


  const onReplay = () => {
    setReplaying(true);
    replayChat();
  }


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
                    replayChat={onReplay}
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
        <Stack
          direction="row"
          spacing={1}
          sx={{
            pl: 2,
            my: 2,
            width: "100%",
            height: showSkeleton ? `${SKELETON_HEIGHT}px` : "0px",
            opacity: showSkeleton ? 1 : 0,
            overflow: "hidden",
            transition: "height 0.5s cubic-bezier(0.4,0,0.2,1), opacity 0.5s cubic-bezier(0.4,0,0.2,1)",
          }}
        >
          <Skeleton sx={{ bgcolor: "primary.main" }} variant="circular" height={35} width={35} aria-label={t("loading.skeleton")} />
          <Stack direction="column" alignItems="left" sx={{ width: "100%" }}>
            <Skeleton sx={{ bgcolor: "primary.main" }} variant="text" width="85%" height={30} aria-label={t("loading.skeleton")} />
            <Skeleton sx={{ bgcolor: "primary.main" }} variant="text" width="82%" height={30} aria-label={t("loading.skeleton")} />
            <Skeleton sx={{ bgcolor: "primary.main" }} variant="text" width="88%" height={30} aria-label={t("loading.skeleton")} />
            <Skeleton sx={{ bgcolor: "primary.main" }} variant="text" width="84%" height={30} aria-label={t("loading.skeleton")} />
            <Skeleton sx={{ bgcolor: "primary.main" }} variant="text" width="87%" height={30} aria-label={t("loading.skeleton")} />
          </Stack>
        </Stack>
        {/* Dynamic whitespace */}
        <div
          style={{
            height: whitespace,
            transition: "height 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
            width: "100%",
          }}
        />
        {scrollable && (
          <IconButton
            id="scroll-down-button"
            onClick={onScrollArrowClick}
            sx={{
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              },
              position: "fixed",
              bottom: { xs: "70px", sm: "80px", md: "90px" },
              right: "40%",
              zIndex: 1200,
              height: "64px",
              width: "64px"
            }}
            aria-label={t("scroll.down")}
          >
            <ArrowCircleDownIcon
              sx={{
                height: "40px",
                width: "40px",
                color: "primary.main",
              }}
              aria-label={t("scroll.down")}
            />
          </IconButton>
        )}
      </Box>
    </Box >
  );
};

export default ChatMessagesContainer;
