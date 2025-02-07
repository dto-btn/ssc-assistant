import CloseIcon from "@mui/icons-material/Close";
import Send from "@mui/icons-material/Send";
import {
  Box,
  CircularProgress,
  Container,
  IconButton,
  InputBase,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import UploadFileButton from "./UploadFileButton";
import { disabledFeaturesSet } from "../allowedTools";

interface ChatInputProps {
  onSend: (question: string, files: Attachment[]) => void;
  disabled: boolean;
  placeholder?: string;
  clearOnSend?: boolean;
  quotedText?: string;
  selectedModel: string;
}

export const ChatInput = ({
  onSend,
  disabled,
  clearOnSend,
  quotedText,
  selectedModel,
}: ChatInputProps) => {
  const [question, setQuestion] = useState<string>("");
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const theme = useTheme();
  const [file, setFile] = useState<Attachment | undefined>(undefined);
  const inputFieldRef = React.useRef<HTMLInputElement>(null);

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
    inputFieldRef.current?.focus();
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
      {file && (
        <Paper
          sx={{
            p: "2px 4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "left",
            borderRadius: "30px 30px 0 0",
            borderColor: theme.palette.primary.main,
            borderWidth: "1px 1px 0px 1px",
            borderStyle: "solid",
          }}
        >
          <IconButton
            onClick={handleRemoveFile}
            // sx={{
            //   alignItems: "top",
            //   mr: -2,
            //   mt: -2,
            //   backgroundColor: "white",
            //   border: "1px solid black",
            //   "&:hover": {
            //     backgroundColor: "white", // maintain white background on hover
            //   },
            // }}
            size="large"
            color="primary"
            aria-description={t("delete") + ": " + t("user.file.upload")}
          >
            <CloseIcon color="primary" />
          </IconButton>
          {/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(file.blob_storage_url) ? (
            <Box
              component="img"
              src={file.blob_storage_url}
              alt={t("uploaded.file.alt")}
              sx={{
                maxWidth: "100%",
                maxHeight: 130,
                borderRadius: "25px",
                padding: "8px",
              }}
            />
          ) : (
            //leaving this code in but it's not used at the moment since we disabled non-image uploads
            <Box
              component="a"
              href={file.blob_storage_url}
              target="_blank"
              rel="noopener noreferrer"
              sx={{ color: "blue", textDecoration: "underline" }}
            >
              {file.file_name}
            </Box>
          )}
        </Paper>
      )}
      <Paper
        component="form"
        sx={{
          p: "2px 5px",
          display: "flex",
          alignItems: "center",
          borderRadius: file ? "0 0 30px 30px" : "40px",
          borderColor: theme.palette.primary.main,
          borderWidth: file ? "0 1px 1px 1px" : "1px",
          borderStyle: "solid",
        }}
      >
        {!disabledFeaturesSet.has("file_upload") && (
          <UploadFileButton disabled={disabled} onFileUpload={onFileUpload} />
        )}
        <InputBase
          sx={{ ml: 1, flex: 1 }}
          placeholder={t("ask.question")}
          inputProps={{ "aria-label": t("ask.question") }}
          error={error}
          id="ask-question"
          onKeyDown={onEnterPress}
          value={question}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
            if (event.target.value && event.target.value.length > 24000)
              setError(true);
            else setError(false);
            setQuestion(event.target.value);
          }}
        />
        <IconButton
          onClick={sendQuestion}
          disabled={disabled}
          sx={{
            "&:hover": {
              backgroundColor: "rgba(0, 0, 0, 0.2)",
            },
          }}
          aria-label={t("send")}
          size="large"
        >
          {disabled ? (
            <CircularProgress size={24} aria-label={t("generating")} />
          ) : (
            <Send sx={{ color: "primary.main" }} aria-label={t("send")} />
          )}
        </IconButton>
      </Paper>
      <Typography
        sx={{
          fontSize: "13px",
          mr: "50px",
          pt: "5px",
          opacity: 0.7,
          textAlign: "right",
        }}
      >
        {t("model.version.disclaimer")} {modelName}
      </Typography>
    </Container>
  );
};
