/**
 * Enhanced ChatInput with Direct Completion Integration
 *
 * Alternative implementation showing how to use the completion service
 * directly in a component using hooks, instead of relying on middleware.
 * This gives you more direct control over the completion flow.
 */

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  addMessage,
  setIsLoading,
  updateMessageContent,
} from "../store/slices/chatSlice";
import { Box, TextField, Button, Paper, IconButton } from "@mui/material";
import FileUpload from "./FileUpload";
import { addToast } from "../store/slices/toastSlice";
import { RootState } from "../store";
import { clearQuotedText } from "../store/slices/quotedSlice";
import CloseIcon from "@mui/icons-material/Close";
import { useCompletion } from "../store/hooks/useCompletion";

interface EnhancedChatInputProps {
  sessionId: string;
}

const EnhancedChatInput: React.FC<EnhancedChatInputProps> = ({ sessionId }) => {
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const dispatch = useDispatch();
  const quotedText = useSelector((state: RootState) => state.quoted.quotedText);
  const messages = useSelector((state: RootState) =>
    state.chat.messages.filter((msg) => msg.sessionId === sessionId)
  );
  const isLoading = useSelector((state: RootState) => state.chat.isLoading);

  // Use the completion hook
  const { createAzure, cancelCompletion } = useCompletion();

  const handleSendWithCompletion = async () => {
    if (!input.trim() && attachments.length === 0) return;

    const userMessage = quotedText ? `> ${quotedText}\n\n${input}` : input;

    // Add user message to chat
    dispatch(
      addMessage({
        sessionId,
        role: "user",
        content: userMessage,
        attachments: attachments.length ? attachments : undefined,
      })
    );

    // Clear input
    setInput("");
    setAttachments([]);
    if (quotedText) dispatch(clearQuotedText());

    // Set loading state
    dispatch(setIsLoading(true));

    try {
      // TODO: Get actual user token from your auth system
      const userToken = "placeholder-user-token";

      // Prepare conversation messages
      const conversationMessages = [
        ...messages.map((msg) => ({
          role: msg.role as "system" | "user" | "assistant",
          content: msg.content,
        })),
        { role: "user" as const, content: userMessage },
      ];

      // Add empty assistant message for streaming updates
      const assistantMessageAction = dispatch(
        addMessage({
          sessionId,
          role: "assistant",
          content: "",
        })
      );

      const assistantMessageId = (assistantMessageAction.payload as any).id;
      let accumulatedContent = "";

      // Call completion with streaming
      await createAzure(conversationMessages, userToken, {
        model: "gpt-4o",
        onStreamChunk: (chunk: string) => {
          accumulatedContent += chunk;
          dispatch(
            updateMessageContent({
              messageId: assistantMessageId,
              content: accumulatedContent,
            })
          );
        },
      });
    } catch (error) {
      console.error("Completion failed:", error);

      // Add error message
      dispatch(
        addMessage({
          sessionId,
          role: "assistant",
          content:
            "Sorry, I encountered an error while processing your request. Please try again.",
        })
      );

      // Show error toast
      dispatch(
        addToast({
          message: error instanceof Error ? error.message : "An error occurred",
          isError: true,
        })
      );
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  const handleFiles = (fileList: FileList) => {
    const files = Array.from(fileList);
    setAttachments((prev) => [...prev, ...files]);
    dispatch(
      addToast({ message: `${files.length} file(s) attached`, isError: false })
    );
  };

  const handleCancel = () => {
    cancelCompletion();
    dispatch(setIsLoading(false));
  };

  return (
    <Box
      p={2}
      borderTop="1px solid #eee"
      display="flex"
      gap={2}
      alignItems="flex-end"
      flexDirection="column"
    >
      {quotedText && (
        <Paper
          sx={{
            p: 1,
            mb: 1,
            width: "100%",
            bgcolor: "grey.100",
            position: "relative",
          }}
        >
          <Box display="flex" alignItems="center">
            <Box flex={1} fontStyle="italic">
              {quotedText}
            </Box>
            <IconButton
              onClick={() => dispatch(clearQuotedText())}
              size="small"
            >
              <CloseIcon />
            </IconButton>
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
          onChange={(event) => setInput(event.target.value)}
          onKeyPress={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              handleSendWithCompletion();
            }
          }}
          multiline
          minRows={1}
          maxRows={5}
          disabled={isLoading}
        />
        {isLoading ? (
          <Button
            variant="outlined"
            color="secondary"
            onClick={handleCancel}
            sx={{ ml: 2 }}
          >
            Cancel
          </Button>
        ) : (
          <Button
            variant="contained"
            color="primary"
            onClick={handleSendWithCompletion}
            sx={{ ml: 2 }}
            disabled={isLoading}
          >
            Send
          </Button>
        )}
      </Box>
    </Box>
  );
};

export default EnhancedChatInput;
