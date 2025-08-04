import InfoIcon from "@mui/icons-material/Info";
import CloseIcon from "@mui/icons-material/Close";
import Send from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
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
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { disabledFeaturesSet } from "../allowedTools";
import { NewFileUploadButton } from "./file-upload/NewFileUploadButton";
import { useDetectedDrag } from "./file-upload/useDetectedDrag";
import { useFileUploadManager } from "./file-upload/useFileUploadManager";
import { FileIconUtils } from "./file-upload/FileIconUtils";

interface ChatInputProps {
  onSend: (question: string, files: Attachment[]) => void;
  disabled: boolean;
  placeholder?: string;
  clearOnSend?: boolean;
  quotedText?: string;
  selectedModel: string;
  file?: Attachment;
  setFile?: (file?: Attachment) => void;
  onError?: (error: ToastMessage) => void;
}

export const ChatInput = ({
  onSend,
  disabled,
  clearOnSend,
  quotedText,
  selectedModel,
  file,
  setFile,
  onError,
}: ChatInputProps) => {
  const [question, setQuestion] = useState<string>("");
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const theme = useTheme();
  const inputFieldRef = React.useRef<HTMLInputElement>(null);
  const hasDetectedDrag = useDetectedDrag({
    onDrop: (event: React.DragEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (event.dataTransfer.files && event.dataTransfer.files.length > 0) {
        const file = event.dataTransfer.files[0];
        doUpload(file);
      }
    },
  });

  const modelName = selectedModel === "gpt-4o" ? "GPT-4o" : "";

  const sendQuestion = () => {
    if (disabled || !question.trim()) {
      return;
    }

    onSend(question, file ? [file] : []);

    if (clearOnSend) {
      setQuestion("");
      // Only clear the file if it was an image.
      if (
        file &&
        /\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(file.blob_storage_url)
      ) {
        setFile?.(undefined);
      }
    }
  };

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
      ev.preventDefault();
      sendQuestion();
    }
  };

  const onFileUpload = (newFile: Attachment) => {
    setFile?.(newFile);
    inputFieldRef.current?.focus();
  };

  const handleRemoveFile = () => {
    setFile?.(undefined);
  };

  const { doUpload, isUploading } = useFileUploadManager(onFileUpload, onError);

  // this useEffect focuses the chatInput whenever quotedText is added
  useEffect(() => {
    if (quotedText) {
      const chatInput = document.getElementById("ask-question");
      chatInput?.focus();
    }
  }, [quotedText]);

  return (
    <>
      <Container
        component="footer"
        sx={(theme) => ({
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
              size="large"
              color="primary"
              aria-description={t("delete") + ": " + t("user.file.upload")}
              aria-label={t("delete")}
            >
              <CloseIcon color="primary" />
            </IconButton>
            {/\.(jpeg|jpg|gif|png|webp|bmp|svg)$/i.test(
              file.blob_storage_url
            ) ? (
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
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "8px 16px",
                  background: "#f5f7fa",
                  borderRadius: "20px",
                  margin: "4px 8px",
                  maxWidth: "350px",
                }}
              >
                <Box
                  sx={{
                    fontSize: "2rem",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {FileIconUtils.getFileIcon(file.file_name, file.type)}
                </Box>
                <Box
                  component="a"
                  href={file.blob_storage_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  sx={{
                    color: FileIconUtils.getFileTypeColor(
                      file.file_name,
                      file.type
                    ),
                    textDecoration: "none",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    wordBreak: "break-all",
                    maxWidth: "280px",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    "&:hover": {
                      textDecoration: "underline",
                    },
                  }}
                >
                  {file.file_name}
                </Box>
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
            borderColor: hasDetectedDrag
              ? theme.palette.secondary.main
              : theme.palette.primary.main,
            borderWidth: file ? "0 1px 1px 1px" : "1px",
            borderStyle: "solid",
            background: hasDetectedDrag
              ? theme.palette.action.hover
              : undefined,
            transition: "background 0.2s, border-color 0.2s",
            minHeight: hasDetectedDrag ? 90 : undefined,
          }}
        >
          {!disabledFeaturesSet.has("file_upload") && !file && !isUploading && (
            <NewFileUploadButton onFileUpload={doUpload} disabled={disabled} />
          )}
          <InputBase
            sx={{ ml: 1, flex: 1 }}
            slotProps={{
              input: {
                tabIndex: 0,
                autoFocus: true,
              },
            }}
            placeholder={`${t("ask.question")}. ${t(
              "model.version.disclaimer"
            )} ${modelName}.`}
            inputProps={{ "aria-label": t("ask.question"), tabIndex: 1 }}
            error={error}
            id="ask-question"
            onKeyDown={onEnterPress}
            value={question}
            multiline
            maxRows={15}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              if (event.target.value && event.target.value.length > 24000)
                setError(true);
              else setError(false);
              setQuestion(event.target.value);
            }}
          />
          <IconButton
            onClick={sendQuestion}
            disabled={disabled || isUploading}
            sx={{
              "&:hover": {
                backgroundColor: "rgba(0, 0, 0, 0.2)",
              },
            }}
            aria-label={t("send")}
            size="large"
          >
            {disabled || isUploading ? (
              <CircularProgress size={24} aria-label={t("generating")} />
            ) : (
              <Send sx={{ color: "primary.main" }} aria-label={t("send")} />
            )}
          </IconButton>
        </Paper>
        <Box
          sx={{
            width: "100%",
            // center items
            display: "flex",
            justifyContent: "center",
            gap: "5px",
            alignItems: "center",
            pt: "5px",
            pb: "5px",
            verticalAlign: "middle",
          }}
        >
          <InfoIcon fontSize="inherit" color="info" /> {t("ai.disclaimer")}
          <Typography
            sx={{
              fontSize: "12px",
              ml: "50px",
              display: "inline",
              // vertically align
            }}
          ></Typography>
        </Box>
      </Container>
      {!disabledFeaturesSet.has("file_upload") &&
        hasDetectedDrag &&
        createPortal(
          <Box
            sx={{
              position: "absolute",
              left: 0,
              top: 0,
              width: "100vw",
              height: "100vh",
              bgcolor: `${theme.palette.background.paper}`,
              // inset dropshadow instead of border
              border: `3px dashed ${theme.palette.primary.main}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
              fontWeight: 600,
              fontSize: 18,
              // color: theme.palette.text.primary,
              zIndex: 9999,
              opacity: 0.85,
              color: theme.palette.primary.main,
              flexDirection: "column",
              gap: 1,
            }}
          >
            <AttachFileIcon
              sx={{
                borderRadius: "10%",
                backgroundColor: theme.palette.background.paper,
                padding: "10px",
                boxShadow: `0 0 5px ${theme.palette.secondary.main}`,
                marginBottom: "10px",
                fontSize: "64px",
                color: theme.palette.secondary.main,
              }}
            />
            <Typography fontSize="24px">Drop file to upload</Typography>
          </Box>,
          document.body
        )}
    </>
  );
};
