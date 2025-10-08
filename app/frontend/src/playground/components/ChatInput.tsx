/**
 * ChatInput component
 *
 * Contains the text input box and send/attach controls used to submit
 * messages in the playground. Exports a controlled input component that
 * integrates with the playground store and middleware for sending events.
 */

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Box, TextField, Button, Paper, IconButton } from "@mui/material";
import FileUpload from "./FileUpload";
import { addToast } from "../store/slices/toastSlice";
import { RootState, AppDispatch } from "../store";
import { clearQuotedText } from "../store/slices/quotedSlice";
import CloseIcon from "@mui/icons-material/Close";
import isFeatureEnabled from "../FeatureGate";
import { useTranslation } from "react-i18next";
import { sendAssistantMessage } from "../store/thunks/assistantThunks";

interface ChatInputProps {
  sessionId: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ sessionId }) => {
  const { t } = useTranslation("playground");
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const dispatch = useDispatch<AppDispatch>();
  const quotedText = useSelector((state: RootState) => state.quoted.quotedText);

  const handleSend = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const messageContent = quotedText ? `> ${quotedText}\n\n${input}` : input;

    dispatch(
      sendAssistantMessage({
        sessionId,
        content: messageContent,
        attachments: attachments.length ? attachments : undefined,
      })
    );

    setInput("");
    setAttachments([]);
    if (quotedText) {
      dispatch(clearQuotedText());
    }
  };

  const handleFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    setAttachments((prev) => [...prev, ...files]);
    dispatch(addToast({ message: `${files.length} ${t("files.attached")}`, isError: false }));
  };

  return (
    <Box p={2} borderTop="1px solid #eee" display="flex" gap={2} alignItems="flex-end" flexDirection="column">
      {quotedText && (
        <Paper sx={{ p: 1, mb: 1, width: "100%", bgcolor: "grey.100", position: "relative" }}>
          <Box display="flex" alignItems="center">
            <Box flex={1} fontStyle="italic">{quotedText}</Box>
            <IconButton onClick={() => dispatch(clearQuotedText())} size="small"><CloseIcon /></IconButton>
          </Box>
        </Paper>
      )}
      <Box width="100%" display="flex" gap={2} alignItems="flex-end">
        {isFeatureEnabled("FileUpload") && <FileUpload onFiles={handleFiles} />}
        <TextField
          fullWidth
          variant="outlined"
          placeholder={t("type.a.message")}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          onKeyPress={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSend();
            }
          }}
          multiline
          minRows={1}
          maxRows={5}
        />
        <Button
          variant="contained"
          color="primary"
          onClick={handleSend}
          sx={{ ml: 2 }}
        >
          {t("send")}
        </Button>
      </Box>
    </Box>
  );
};

export default ChatInput;