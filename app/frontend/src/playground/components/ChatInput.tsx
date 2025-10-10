/**
 * ChatInput component
 *
 * Contains the text input box and send/attach controls used to submit
 * messages in the playground. Exports a controlled input component that
 * integrates with the playground store and middleware for sending events.
 */

import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { addMessage } from "../store/slices/chatSlice";
import { Box, TextField, Button, Paper, IconButton } from "@mui/material";
import FileUpload from "./FileUpload";
import { addToast } from "../store/slices/toastSlice";
import { RootState } from "../store";
import { clearQuotedText } from "../store/slices/quotedSlice";
import CloseIcon from "@mui/icons-material/Close";
import isFeatureEnabled from "../FeatureGate";
import { useTranslation } from 'react-i18next';
import { useSelector as useTypedSelector } from "react-redux";
import { createBlobViaApi, updateBlobMetadata, getOidFromAccessToken, moveBlob } from "../api/storage";
import { addUserFileToOutbox } from "../store/slices/outboxSlice";

interface ChatInputProps {
  sessionId: string;
}

const ChatInput: React.FC<ChatInputProps> = ({ sessionId }) => {
  const { t } = useTranslation('playground');
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<File[]>([]);
  const dispatch = useDispatch();
  const quotedText = useSelector((state: RootState) => state.quoted.quotedText);
  const accessToken = useTypedSelector((state: RootState) => state.auth.accessToken);

  const handleSend = () => {
    if (!input.trim() && attachments.length === 0) return;
    // Fire and forget upload of any attached files via secure API; tag standardized metadata
    if (attachments.length) {
      // Always add to outbox first for local persistence
      (async () => {
        for (const file of attachments) {
          try {
            const b64 = await fileToDataUrl(file);
            dispatch(addUserFileToOutbox({ originalName: file.name, dataUrl: b64 }));
          } catch {
            // ignore read errors
          }
        }
      })();
    }
    if (attachments.length && accessToken) {
      const token = accessToken;
      (async () => {
        for (const file of attachments) {
          try {
            const b64 = await fileToDataUrl(file);
            const result = await createBlobViaApi({ encodedFile: b64, name: file.name, accessToken: token });
            // Move into per-user folder for organization: users/<oid>/files/<filename>
            try {
              const oid = getOidFromAccessToken(token);
              if (oid) {
                const destName = `users/${oid}/files/${file.name}`;
                await moveBlob({ sourceName: result.blobName, destName, accessToken: token });
                // Update blobName to point to new location for tagging
                result.blobName = destName as unknown as string; // local use only
              }
            } catch {
              // ignore move errors (keeps file at root)
            }
            // tag for RAG discovery (best-effort)
            try {
              await updateBlobMetadata({
                blobName: result.blobName,
                metadata: {
                  type: "user-file",
                  originalname: file.name,
                  uploadedat: new Date().toISOString(),
                },
                accessToken: token,
              });
            } catch (e) {
              // ignore metadata tagging errors in playground
            }
          } catch (e) {
            // ignore upload errors in playground
          }
        }
      })();
    }
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
        {isFeatureEnabled('FileUpload') && <FileUpload onFiles={handleFiles} />}
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

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}