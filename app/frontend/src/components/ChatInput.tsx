import {
  Box,
  Container,
  TextField,
  InputAdornment,
  IconButton,
  CircularProgress,
  styled,
  Typography,
  useTheme,
} from "@mui/material";
import Send from "@mui/icons-material/Send";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import KeyboardReturnIcon from "@mui/icons-material/KeyboardReturn";
import CloseIcon from "@mui/icons-material/Close";
import UploadFileButton from "./UploadFileButton";

interface ChatInputProps {
  onSend: (question: string, files: Attachment[]) => void;
  disabled: boolean;
  placeholder?: string;
  clearOnSend?: boolean;
  quotedText?: string;
  handleRemoveQuote: () => void;
  selectedModel: string;
}

export const ChatInput = ({
  onSend,
  disabled,
  clearOnSend,
  quotedText,
  handleRemoveQuote,
  selectedModel,
}: ChatInputProps) => {
  const [question, setQuestion] = useState<string>("");
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const theme = useTheme();
  const [file, setFile] = useState<Attachment | undefined>(undefined);

  const modelName = selectedModel === "gpt-4o" ? "GPT-4o" : "GPT-3.5 Turbo";

  const sendQuestion = () => {
    if (disabled || !question.trim()) {
      return;
    }

    onSend(question, file ? [file] : []);

    if (clearOnSend) {
      setQuestion("");
      setFile(undefined);
    }
  };

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      sendQuestion();
    }
  };

  const onFileUpload = (file: Attachment) => {
    setFile(file);
  };

  const handleRemoveFile = () => {
    setFile(undefined);
  };

  // this useEffect focuses the chatInput whenever quotedText is added
  useEffect(() => {
    if (quotedText) {
      const chatInput = document.getElementById("ask-question");
      chatInput?.focus();
    }
  }, [quotedText]);

  return (
    <Container
      component="footer"
      sx={(theme) => ({
        mb: 3,
        position: "sticky",
        bottom: 0,
        // box shadow fading upwards
        boxShadow: "0px -15px 20px " + theme.palette.background.default,
      })}
    >
      <ChatInputWrapper theme={theme}>
        {quotedText && (
          <QuoteContainer>
            <KeyboardReturnIcon
              sx={{ transform: "scaleX(-1)", ml: "8px", color: "black" }}
            />
            <Typography
              variant="body1"
              sx={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                maxWidth: "calc(100% - 24px)",
                fontSize: "14px",
                ml: "10px",
                mr: "5px",
                color: "black",
                flex: 1,
              }}
            >
              "{quotedText}"
            </Typography>
            <IconButton
              onClick={handleRemoveQuote}
              sx={{
                mr: "5px",
                "&:hover": {
                  backgroundColor: "#979797",
                },
              }}
            >
              <CloseIcon
                sx={{
                  fontSize: "20px",
                  color: "black",
                }}
              />
            </IconButton>
          </QuoteContainer>
        )}
        <Box component="form" noValidate autoComplete="off">
          <TextField
            error={error}
            helperText={error ? t("question.maxlength") : ""}
            value={question}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              if (event.target.value && event.target.value.length > 24000)
                setError(true);
              else setError(false);
              setQuestion(event.target.value);
            }}
            fullWidth
            type="text"
            id="ask-question"
            onKeyDown={onEnterPress}
            multiline={true}
            minRows={3}
            maxRows={3}
            label={t("ask.question")}
            sx={{
              padding: "0px 20px",
              "& .MuiInputBase-input::placeholder": {
                opacity: 0.7,
              },
              ".MuiFormLabel-root": {
                padding: "5px 0px 0px 20px",
              },
            }}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              startAdornment: file && (
                <Box
                  display="flex"
                  alignItems="start"
                  mb={2}
                  sx={{ padding: 1, mr: 3 }}
                >
                  <IconButton
                    onClick={handleRemoveFile}
                    sx={{
                      mr: -2,
                      mt: -2,
                      backgroundColor: "white",
                      border: "1px solid black",
                      "&:hover": {
                        backgroundColor: "white", // maintain white background on hover
                      },
                    }}
                    size={"small"}
                    color="primary"
                    aria-description={t("delete") + ": " + t("user.file.upload")}
                  >
                    <CloseIcon color="primary" />
                  </IconButton>
                  {/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(file.blob_storage_url) ? (
                    <Box
                      component="img"
                      src={file.encoded_file}
                      alt={t("uploaded.file.alt")}
                      sx={{ maxWidth: "100%", maxHeight: 100, borderRadius: 2 }}
                    />
                  ) : (
                    //leaving this code in but it's not used at the moment since we disabled non-image uploads
                    <Box
                      component="a"
                      href={file.encoded_file}
                      target="_blank"
                      rel="noopener noreferrer"
                      sx={{ color: "blue", textDecoration: "underline" }}
                    >
                      {file.file_name}
                    </Box>
                  )}
                </Box>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={sendQuestion}
                    disabled={disabled}
                    sx={{
                      "&:hover": {
                        backgroundColor: "rgba(0, 0, 0, 0.2)",
                      },
                    }}
                    aria-label={t("send")}
                  >
                    {" "}
                    {disabled ? (
                      <CircularProgress
                        size={24}
                        aria-label={t("generating")}
                      />
                    ) : (
                      <Send
                        sx={{ color: "primary.main" }}
                        aria-label={t("send")}
                      />
                    )}
                  </IconButton>
                  <UploadFileButton
                    disabled={disabled}
                    onFileUpload={onFileUpload}
                  />
                </InputAdornment>
              ),
            }}
          ></TextField>
        </Box>
        <Typography
          sx={{
            fontSize: "13px",
            mr: "10px",
            opacity: 0.7,
            textAlign: "right",
          }}
        >
          {t("model.version.disclaimer")} {modelName}
        </Typography>
      </ChatInputWrapper>
    </Container>
  );
};

const ChatInputWrapper = styled(Box)(({ theme }) => ({
  border: "2px solid #e0e0e0",
  borderRadius: "5px",
  "&:focus-within": {
    borderColor: theme.palette.primary.main,
  },
}));

const QuoteContainer = styled(Box)`
  display: flex;
  align-items: center;
  height: 60px;
  width: 95%;
  margin: 10px 0px 0px 20px;
  background-color: lightgrey;
  border-radius: 10px;
`;
