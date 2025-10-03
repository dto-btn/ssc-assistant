/**
 * SessionSidebar component
 *
 * Displays the list of saved playground sessions, allows switching between
 * sessions and basic session management (rename, delete, export). Integrates
 * with the playground `sessionSlice`.
 */

import React, { useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../store";
import {
  addSession,
  removeSession,
  setCurrentSession,
  renameSession,
} from "../store/slices/sessionSlice";
import { v4 as uuidv4 } from "uuid";
import {
  List,
  ListItem,
  ListItemText,
  Button,
  Box,
  Typography,
  IconButton,
  ListItemButton,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import type { Session } from "../store/slices/sessionSlice";
import SessionRenameDialog from "./SessionRenameDialog";
import { useTranslation } from 'react-i18next';

const SessionSidebar: React.FC = () => {
  const { t } = useTranslation('playground');
  const sessions = useSelector((state: RootState) => state.sessions.sessions);
  const currentSessionId = useSelector(
    (state: RootState) => state.sessions.currentSessionId
  );
  const dispatch = useDispatch();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);

  const handleNewSession = () => {
    dispatch(
      addSession({
        id: uuidv4(),
        name: `Conversation ${sessions.length + 1}`,
        createdAt: Date.now(),
      })
    );
  };

  const sessionName = (id: string) =>
    sessions.find((session) => session.id === id)?.name ?? "";

  const handleRenameSession = (newName: string) => {
    if (sessionToRename) {
      dispatch(renameSession({ id: sessionToRename, name: newName }));
    }
    setRenameDialogOpen(false);
    setSessionToRename(null);
  };

  return (
    <Box
      width={250}
      bgcolor="grey.100"
      p={2}
      borderRight="1px solid #ddd"
      height="100vh"
    >
      {/* Header */}
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">{t("chats")}</Typography>
        <Button size="small" onClick={handleNewSession} variant="outlined">
          {t("new")}
        </Button>
      </Box>

      {/* Sessions List */}
      <List>
        {sessions.map((session: Session) => (
          <ListItem
            key={session.id}
            disablePadding
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <ListItemButton
              selected={session.id === currentSessionId}
              onClick={() => dispatch(setCurrentSession(session.id))}
            >
              <ListItemText primary={session.name} />
            </ListItemButton>

            {/* Actions Container (Rename & Delete Buttons) */}
            <Box display="flex" alignItems="center">
              <IconButton
                size="small"
                onClick={(e) => {
                  e.stopPropagation();
                  setSessionToRename(session.id);
                  setRenameDialogOpen(true);
                }}
                title={t("rename.conversation")}
              >
                <EditIcon fontSize="small" />
              </IconButton>

              <IconButton
                size="small"
                color="error"
                onClick={(e) => {
                  e.stopPropagation();
                  dispatch(removeSession(session.id));
                }}
                title={t("delete.conversation")}
              >
                <DeleteIcon fontSize="small" />
              </IconButton>
            </Box>
          </ListItem>
        ))}
      </List>

      {/* Rename Session Dialog */}
      <SessionRenameDialog
        open={renameDialogOpen}
        initialValue={sessionToRename ? sessionName(sessionToRename) : ""}
        onClose={() => setRenameDialogOpen(false)}
        onRename={handleRenameSession}
      />
    </Box>
  );
};

export default SessionSidebar;