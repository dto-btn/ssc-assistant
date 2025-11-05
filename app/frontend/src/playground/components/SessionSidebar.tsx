/**
 * SessionSidebar component
 *
 * Displays the list of saved playground sessions, allows switching between
 * sessions and basic session management (rename, delete, export). Integrates
 * with the playground `sessionSlice`.
 */

import React, { useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  addSession,
  removeSession,
  setCurrentSession,
  renameSession,
} from "../store/slices/sessionSlice";
import { v4 as uuidv4 } from "uuid";
import {
  Chip,
  Divider,
  List,
  ListItem,
  ListItemText,
  Box,
  Typography,
  IconButton,
  ListItemButton,
  ListItemIcon,
  Menu,
  MenuItem,
  Tooltip,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCommentIcon from "@mui/icons-material/AddComment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import type { Session } from "../store/slices/sessionSlice";
import { useTranslation } from 'react-i18next';
import { LEFT_MENU_WIDTH } from "../constants";
import SessionRenameDialog from "./SessionRenameDialog";
import { selectSessionsNewestFirst } from "../store/selectors/sessionSelectors";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import ProfileMenu from "./ProfileMenu/ProfileMenu";
import { DevBanner } from "./DevBanner"

/**
 * Sidebar for listing and managing Playground chat sessions.
 *
 * Renders a “New chat” action, a list of sessions (newest first), and a per-session
 * overflow menu with rename/delete actions. State is persisted via the playground
 * Redux store (sessionSlice) and text is localized using the 'playground' namespace.
 */
const SessionSidebar: React.FC = () => {
  const { t } = useTranslation('playground');
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const sessionsNewestFirst = useAppSelector(selectSessionsNewestFirst);
  const currentSessionId = useAppSelector((state) => state.sessions.currentSessionId);
  const currentSessionMessages = useAppSelector(selectMessagesBySessionId);
  const dispatch = useAppDispatch();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);

  /**
   * Create a new session unless the currently selected session is empty, in which
   * case we keep the current session active to avoid creating duplicates.
   */
  const handleNewSession = useCallback(() => {
    // If current session exists and has no messages, just keep it selected
    if (currentSessionId && currentSessionMessages.length === 0) {
      dispatch(setCurrentSession(currentSessionId));
      return;
    }

    dispatch(
      addSession({
        id: uuidv4(),
        name: `Conversation ${sessions.length + 1}`,
        createdAt: Date.now(),
      })
    );
  }, [dispatch, sessions.length, currentSessionId, currentSessionMessages.length]);

  /**
   * Resolve a session name by id.
   *
   * @param id Session identifier
   * @returns The session name or an empty string if not found
   */
  const sessionName = (id: string) =>
    sessions.find((session) => session.id === id)?.name ?? "";

  // Derived sessions order handled by selector

  /**
   * Confirm handler for the rename dialog. Persists the new name to the store
   * and closes the dialog.
   *
   * @param newName The updated name for the session being renamed
   */
  const handleRenameSession = (newName: string) => {
    if (sessionToRename) {
      dispatch(renameSession({ id: sessionToRename, name: newName }));
    }
    setRenameDialogOpen(false);
    setSessionToRename(null);
  };

  /**
   * Open the per-session overflow (more) menu for the given session id.
   *
   * @param event Button click event used to anchor the menu
   * @param sessionId The id of the session whose menu is being opened
   */
  const handleMoreMenuClick = useCallback(
    (
      event: React.MouseEvent<HTMLButtonElement>,
      sessionId: string
    ) => {
      setMoreMenuAnchor(event.currentTarget);
      setSelectedSessionId(sessionId);
    },
    []
  );

  /**
   * Delete the currently selected session from the overflow menu.
   */
  const handleDeleteClicked = useCallback(() => {
    if (selectedSessionId) {
      dispatch(removeSession(selectedSessionId));
      setMoreMenuAnchor(null);
      setSelectedSessionId(null);
    }
  }, [dispatch, selectedSessionId]);

  /**
   * Open the rename dialog for the currently selected session.
   */
  const handleRenameClicked = useCallback(() => {
    if (selectedSessionId) {
      setSessionToRename(selectedSessionId);
      setRenameDialogOpen(true);
    }
    setMoreMenuAnchor(null);
  }, [selectedSessionId]);

  const moreMenuOpen = Boolean(moreMenuAnchor);

  return (
    <Box
      role="presentation"
      sx={{
        width: LEFT_MENU_WIDTH,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowX: "hidden",
        borderRight: "1px solid #ddd",
        bgcolor: "#ededf3",
      }}
    >
      <List>
        {/* New chat button, styled like main app */}
        <ListItem key="newChat" disablePadding>
          <ListItemButton id="new-chat-button" onClick={handleNewSession}>
            <ListItemIcon sx={{ minWidth: "0px", mr: "10px" }}>
              <AddCommentIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={t("new")}
              aria-description={t("select.or.create.session")}
              aria-label={t("new")}
            />
          </ListItemButton>
        </ListItem>

        <Divider sx={{ my: 1 }}>
          <Chip label={t("chats")} size="small" sx={{ backgroundColor: "transparent" }} />
        </Divider>

          {sessionsNewestFirst.map((session: Session) => (
            <ListItem
              key={session.id}
              sx={{
                display: "flex",
                flexDirection: "row",
                p: "2px 0px",
                backgroundColor:
                  session.id === currentSessionId ? "lightgray" : "transparent",
                "&:hover": {
                  backgroundColor: "lightgray",
                },
                transition: "none",
                // Hide the more button by default; show on hover or focus within
                "& .more-button": {
                  opacity: 0,
                  transition: "opacity 0.15s ease-in-out",
                },
                "&:hover .more-button, &:focus-within .more-button": {
                  opacity: 1,
                },
              }}
            >
              <ListItemButton
                id={`session-button-${session.id}`}
                disableRipple
                sx={{
                  padding: "5px 10px",
                  "&:hover": { backgroundColor: "transparent" },
                }}
                onClick={() => dispatch(setCurrentSession(session.id))}
                aria-current={session.id === currentSessionId ? "true" : undefined}
              >
                <Typography
                  noWrap
                  sx={{ width: "100%", overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {session.name}
                </Typography>
              </ListItemButton>

              <IconButton
                id={`session-options-button-${session.id}`}
                className="more-button"
                onClick={(event) => handleMoreMenuClick(event, session.id)}
                aria-label={t('options')}
                aria-controls={moreMenuOpen ? "session-menu" : undefined}
                aria-expanded={moreMenuOpen ? "true" : undefined}
                aria-haspopup="true"
                sx={{ mr: "10px", "&:hover": { backgroundColor: "transparent", color: "black" } }}
              >
                <Tooltip
                  title={t('options')}
                  placement="top"
                  slotProps={{
                    popper: {
                      sx: {
                        "& .MuiTooltip-tooltip": { backgroundColor: "black", color: "white" },
                      },
                      modifiers: [
                        { name: "offset", options: { offset: [0, 5] } },
                      ],
                    },
                  }}
                >
                  <MoreHorizIcon />
                </Tooltip>
              </IconButton>
            </ListItem>
          ))}

        {/* Shared Menu like main app */}
        <Menu
          id="session-menu"
          MenuListProps={{
            "aria-labelledby": selectedSessionId ? `session-options-button-${selectedSessionId}` : undefined,
          }}
          anchorEl={moreMenuAnchor}
          open={moreMenuOpen}
          onClose={() => setMoreMenuAnchor(null)}
        >
          <MenuItem id={`delete-session-${selectedSessionId}`} onClick={handleDeleteClicked} tabIndex={0}>
            <DeleteIcon sx={{ mr: "15px" }} />
            <Typography>{t("delete")}</Typography>
          </MenuItem>
          <MenuItem id={`rename-session-${selectedSessionId}`} onClick={handleRenameClicked} tabIndex={0}>
            <EditIcon sx={{ mr: "15px" }} />
            <Typography>{t("rename")}</Typography>
          </MenuItem>
        </Menu>
      </List>

      {/* Rename Session Dialog */}
      <SessionRenameDialog
        open={renameDialogOpen}
        initialValue={sessionToRename ? sessionName(sessionToRename) : ""}
        onClose={() => setRenameDialogOpen(false)}
        onRename={handleRenameSession}
      />
      <Box  //floats to bottom of sidebar
        sx={{
          marginTop: "auto",
          display: "flex",
          gap: "1rem",
        }}
      >
        <ProfileMenu
          size="30px"
          fontSize="12px"
          logout={() => console.log("logout")}
        />
      </Box>
      <DevBanner />
    </Box>
  );
};

export default SessionSidebar;