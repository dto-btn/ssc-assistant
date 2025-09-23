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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import SessionRenameDialog from "./SessionRenameDialog";
import type { Session } from "../store/slices/sessionSlice";

const SessionSidebar: React.FC = () => {
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
  sessions.find((s: { id: string; name?: string }) => s.id === id)?.name ?? "";

  return (
    <Box
      width={250}
      bgcolor="grey.100"
      p={2}
      borderRight="1px solid #ddd"
      height="100vh"
    >
      <Box display="flex" justifyContent="space-between" alignItems="center">
        <Typography variant="h6">Chats</Typography>
        <Button size="small" onClick={handleNewSession} variant="outlined">
          New
        </Button>
      </Box>
      <List>
        {sessions.map((session: Session) => (
          <ListItem
            key={session.id}
            selected={session.id === currentSessionId}
            button
            onClick={() => dispatch(setCurrentSession(session.id))}
            secondaryAction={
              <>
                <IconButton
                  size="small"
                  onClick={e => {
                    e.stopPropagation();
                    setSessionToRename(session.id);
                    setRenameDialogOpen(true);
                  }}
                  title="Rename Conversation"
                >
                  <EditIcon fontSize="small" />
                </IconButton>
                <Button
                  size="small"
                  color="error"
                  onClick={e => {
                    e.stopPropagation();
                    dispatch(removeSession(session.id));
                  }}
                >
                  X
                </Button>
              </>
            }
          >
            <ListItemText primary={session.name} />
          </ListItem>
        ))}
      </List>
      <SessionRenameDialog
        open={renameDialogOpen}
        initialValue={sessionToRename ? sessionName(sessionToRename) : ""}
        onClose={() => setRenameDialogOpen(false)}
        onRename={(newName) => {
          if (sessionToRename) {
            dispatch(renameSession({ id: sessionToRename, name: newName }));
          }
        }}
      />
    </Box>
  );
};

export default SessionSidebar;