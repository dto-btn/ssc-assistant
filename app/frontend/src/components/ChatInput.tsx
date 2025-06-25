import InfoIcon from "@mui/icons-material/Info";
import CloseIcon from "@mui/icons-material/Close";
import Send from "@mui/icons-material/Send";
import AttachFileIcon from "@mui/icons-material/AttachFile";
import DocumentScannerRounded from "@mui/icons-material/DocumentScannerRounded";
import {
  Box,
  CircularProgress,
  Container,
  IconButton,
  InputBase,
  Menu,
  MenuItem,
  Paper,
  Typography,
  useTheme,
} from "@mui/material";
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { UploadFileButtonMenuItem } from "./UploadFileButtonMenuItem";
import { disabledFeaturesSet } from "../allowedTools";
import { StyledIconButton } from './StyledIconButton';

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
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const [dragActive, setDragActive] = useState(false);

  const modelName = selectedModel === "gpt-4o" ? "GPT-4o" : "";

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

  const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };
  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  // this useEffect focuses the chatInput whenever quotedText is added
  useEffect(() => {
    if (quotedText) {
      const chatInput = document.getElementById("ask-question");
      chatInput?.focus();
    }
  }, [quotedText]);

  // Drag event handlers for visual dropbox (now on window)
  useEffect(() => {
    const hasFiles = (e: DragEvent) => {
      if (!e.dataTransfer) return false;
      // Prefer items for modern browsers
      if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        return Array.from(e.dataTransfer.items).some(item => item.kind === 'file');
      }
      // Fallback for types
      if (e.dataTransfer.types) {
        return Array.from(e.dataTransfer.types).includes('Files');
      }
      return false;
    };
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (hasFiles(e)) setDragActive(true);
    };
    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);
    };
    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (hasFiles(e)) setDragActive(true);
      else setDragActive(false);
    };
    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('dragover', handleWindowDragOver);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('dragover', handleWindowDragOver);
    };
  }, []);

  return (
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
          borderColor: dragActive ? theme.palette.secondary.main : theme.palette.primary.main,
          borderWidth: file ? "0 1px 1px 1px" : "1px",
          borderStyle: "solid",
          background: dragActive ? theme.palette.action.hover : undefined,
          transition: 'background 0.2s, border-color 0.2s',
          minHeight: dragActive ? 90 : undefined,
        }}
      >
        {dragActive && (
          <Box
            sx={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: '100%',
              height: '100%',
              bgcolor: `${theme.palette.background.paper}`,
              // inset dropshadow instead of border
              border: `3px dashed ${theme.palette.primary.main}`,
              zIndex: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              fontWeight: 600,
              fontSize: 18,
              color: theme.palette.text.primary,
            }}
          >
            <AttachFileIcon sx={{ mr: 1 }} />
            Drop file to upload
          </Box>
        )}
        {!disabledFeaturesSet.has("file_upload") && !file && (
          <>
            <IconButton
              aria-label="upload options"
              onClick={handleMenuClick}
              disabled={disabled}
              size="large"
            >
              <AttachFileIcon />
            </IconButton>
            <Menu
              anchorEl={anchorEl}
              open={open}
              onClose={handleMenuClose}
              style={{
                // make it look sleeck and fit the content
                maxWidth: "300px",
                minWidth: "200px",
              }}
            >
              <UploadFileButtonMenuItem disabled={disabled} onFileUpload={onFileUpload} />
              <MenuItem>
                <StyledIconButton>
                  <DocumentScannerRounded />
                </StyledIconButton>
                {t("attach.document")}
              </MenuItem>
            </Menu>
          </>
        )}
        <InputBase
          sx={{ ml: 1, flex: 1 }}
          slotProps={{
            input: {
              tabIndex: 0,
              autoFocus: true,
            }
          }}
          placeholder={`${t("ask.question")}. ${t("model.version.disclaimer")} ${modelName}.`}
          inputProps={{ "aria-label": t("ask.question"), "tabIndex": 1 }}
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
      <Box sx={{
        width: "100%",
        // center items
        display: "flex",
        justifyContent: "center",
        gap: "5px",
        alignItems: "center",
        pt: "5px",
        pb: "5px",
        verticalAlign: "middle",
      }}>
        <InfoIcon fontSize="inherit" color='info' /> {t("ai.disclaimer")}
        <Typography
          sx={{
            fontSize: "12px",
            ml: "50px",
            display: "inline",
            // vertically align 
          }}
        >
        </Typography>
      </Box>
    </Container>
  );
};
