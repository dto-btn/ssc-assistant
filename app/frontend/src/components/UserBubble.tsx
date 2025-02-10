import { Box, Paper, Typography, styled } from "@mui/material";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import "highlight.js/styles/github.css";
import { visuallyHidden } from "@mui/utils";
import { t } from "i18next";

interface UserChatProps {
  text: string | null | undefined;
  quote?: string;
  attachments?: Attachment[];
}

export const UserBubble = ({ text, quote, attachments }: UserChatProps) => {
  // keeping this here for typesafety because we are ts-expect-error down in the return
  const url: string | undefined =
    attachments && attachments[0]?.blob_storage_url;

  return (
    <Box sx={{ display: "flex", justifyContent: "flex-end", my: "1rem" }}>
      <Paper
        sx={{
          bgcolor: "primary.main",
          color: "primary.contrastText",
          borderRadius: "20px",
          borderTopRightRadius: 0,
          maxWidth: "70%",
        }}
        elevation={4}
      >
        {quote && (
          <QuoteContainer>
            <Typography
              variant="body1"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                maxWidth: "calc(100% - 10px)",
                pl: "10px",
                fontSize: "14px",
                color: "black",
                flex: 1,
              }}
            >
              "{quote}"
            </Typography>
          </QuoteContainer>
        )}
        <UserBubbleContainer tabIndex={0}>
          {url && (
            <ImageContainer>
              <img
                src={url}
                aria-description={t("user.file.upload")}
                height={550}
              />
            </ImageContainer>
          )}
          <Typography sx={visuallyHidden}>{t("aria.user.question")}</Typography>{" "}
          {/* Hidden div for screen reader */}
          <Markdown
            rehypePlugins={[rehypeHighlight]}
            remarkPlugins={[remarkGfm]}
          >
            {text}
          </Markdown>
        </UserBubbleContainer>
      </Paper>
    </Box>
  );
};

const UserBubbleContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  padding: 0px 15px;
  max-width: 100%;
`;

const QuoteContainer = styled(Box)`
  display: flex;
  align-items: center;
  height: 60px;
  margin: 10px 10px 0px 10px;
  background-color: white;
  border-radius: 10px;
`;

const ImageContainer = styled(Box)`
  padding-top: 15px;
`;
