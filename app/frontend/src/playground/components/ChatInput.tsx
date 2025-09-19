import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addMessage } from "../store/slices/chatSlice";
import { Box, TextField, Button, Paper, IconButton } from "@mui/material";
import FileUpload from "./FileUpload";
import { addToast } from "../store/slices/toastSlice";
import { RootState } from "../store";
import { clearQuotedText } from "../store/slices/qoutedSlice";
import CloseIcon from "@mui/icons-material/Close";

interface ChatInputProps {
  sessionId: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ sessionId }) => {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const dispatch = useDispatch();
  const quotedText = useSelector((state: RootState) => state.quoted.quotedText);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    dispatch(
      addMessage({
        sessionId,
        role: "user",
        content: quotedText ? `> ${quotedText}\n\n${input}` : input,
        attachments: attachments.length ? attachments : undefined,
      })
    );
    setInput("");
    setAttachments([]);
    if (quotedText) dispatch(clearQuotedText());
    // Assistant response handled by middleware
  };

  const handleFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    setAttachments((prev) => [...prev, ...files]);
    dispatch(addToast({ message: `${files.length} file(s) attached`, isError: false }));
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
        <FileUpload onFiles={handleFiles} />
        <TextField
          fullWidth
          variant="outlined"
          placeholder="Type a message..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
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
          Send
        </Button>
      </Box>
    </Box>
  );
};

export default ChatInput;