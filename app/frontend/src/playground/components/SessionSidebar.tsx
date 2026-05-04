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
  setCurrentSession,
  renameSession,
} from "../store/slices/sessionSlice";
import { v4 as uuidv4 } from "uuid";
import {
  Chip,
  CircularProgress,
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
  Drawer,
  useTheme,
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCommentIcon from "@mui/icons-material/AddComment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CloseIcon from "@mui/icons-material/Close";
import type { Session } from "../store/slices/sessionSlice";
import { useTranslation } from 'react-i18next';
import { LEFT_MENU_EXPANDED_WIDTH } from "../constants";
import SessionRenameDialog from "./SessionRenameDialog";
import { selectSessionsNewestFirst } from "../store/selectors/sessionSelectors";
import SyncStatusIndicator from "./SyncStatusIndicator";
import ProfileMenu from "./ProfileMenu/ProfileMenu";
import { deleteSession as deleteSessionThunk, persistSessionRename } from "../store/thunks/sessionManagementThunks";
import { closeMobileSidebar } from "../store/slices/uiSlice";
import { loadMoreSessionsFromStorage } from "../store/thunks/sessionBootstrapThunks";

/**
 * Sidebar for listing and managing Playground chat sessions.
 *
 * Renders a “New chat” action, a list of sessions (newest first), and a per-session
 * overflow menu with rename/delete actions. State is persisted via the playground
 * Redux store (sessionSlice) and text is localized using the 'playground' namespace.
 */
interface SessionSidebarProps {
  /** True when the layout is running in mobile drawer mode. */
  isMobile: boolean;
}

const SessionSidebar: React.FC<SessionSidebarProps> = ({ isMobile }) => {
  const { t } = useTranslation('playground');
  const theme = useTheme();
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const sessionsNewestFirst = useAppSelector(selectSessionsNewestFirst);
  const currentSessionId = useAppSelector((state) => state.sessions.currentSessionId);
  const remoteSessionPaging = useAppSelector((state) => state.sessions.remoteSessionPaging);
  const isSidebarCollapsed = useAppSelector(
    (state) => state.ui.isSidebarCollapsed
  );
  const isMobileSidebarOpen = useAppSelector(
    (state) => state.ui.isMobileSidebarOpen
  );
  const dispatch = useAppDispatch();

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const wasMobileSidebarOpenRef = React.useRef(false);

  React.useEffect(() => {
    if (!isMobile) {
      return;
    }

    if (!isMobileSidebarOpen && wasMobileSidebarOpenRef.current) {
      // Return focus to the opener after the temporary drawer closes.
      const opener = document.getElementById("playground-open-sidebar-button");
      if (opener instanceof HTMLElement) {
        opener.focus();
      } else {
        const fallback = document.getElementById("new-chat-button");
        if (fallback instanceof HTMLElement) {
          fallback.focus();
        }
      }
    }

    wasMobileSidebarOpenRef.current = isMobileSidebarOpen;
  }, [isMobile, isMobileSidebarOpen]);

  /**
   * Create a new session unless the currently selected session is empty, in which
   * case we keep the current session active to avoid creating duplicates.
   */
  const handleNewSession = useCallback(() => {
    const activeSession = currentSessionId
      ? sessions.find((session) => session.id === currentSessionId)
      : undefined;

    if (activeSession?.isNewChat) {
      return;
    }

    const existingDraftSession = sessions.find(
      (chatSession) => chatSession.isNewChat === true
    );
    if (existingDraftSession) {
      dispatch(setCurrentSession(existingDraftSession.id));
      return;
    }

    dispatch(
      addSession({
        id: uuidv4(),
        name: `Conversation ${sessions.length + 1}`,
        createdAt: Date.now(),
        isNewChat: true,
      })
    );
  }, [currentSessionId, dispatch, sessions]);

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
    const trimmedName = newName.trim();
    if (sessionToRename && trimmedName) {
      dispatch(renameSession({ id: sessionToRename, name: trimmedName }));
      void dispatch(persistSessionRename(sessionToRename, trimmedName));
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
      void dispatch(deleteSessionThunk(selectedSessionId));
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
  const showLoadMoreButton = remoteSessionPaging.hasMore;
  const isLoadingMoreSessions = remoteSessionPaging.isLoadingMore;

  const sidebarTitleId = "playground-session-sidebar-title";

  const sidebarContent = (
    <Box
      component="nav"
      aria-label={t("sidebar.navigation")}
      sx={{
        width: LEFT_MENU_EXPANDED_WIDTH,
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflowX: "hidden",
        borderRight: "1px solid",
        borderColor: "divider",
        bgcolor: "background.default",
      }}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
          py: 1,
          height: 60,
          boxSizing: 'border-box'
        }}
      >
        <Typography component="h2" id={sidebarTitleId} variant="subtitle2" sx={{ px: 1, fontWeight: 'bold' }}>
          {t("chats")}
        </Typography>
        {isMobile && (
          <IconButton
            onClick={() => dispatch(closeMobileSidebar())}
            aria-label={t("sidebar.close")}
            title={t("sidebar.close")}
          >
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      <List id="playground-session-sidebar" aria-labelledby={sidebarTitleId}>
        <ListItem key="newChat" disablePadding>
          <ListItemButton
            id="new-chat-button"
            onClick={handleNewSession}
            sx={{
              borderRadius: 1.5,
              mx: 1,
              backgroundColor:
                theme.palette.mode === "dark" ? "rgba(120, 132, 180, 0.18)" : "transparent",
              "&:hover": {
                backgroundColor:
                  theme.palette.mode === "dark" ? "rgba(140, 152, 201, 0.28)" : "action.hover",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: "0px", mr: "10px" }}>
              <AddCommentIcon
                fontSize="small"
                sx={{ color: theme.palette.mode === "dark" ? theme.palette.common.white : theme.palette.primary.main }}
              />
            </ListItemIcon>
            <ListItemText
              primary={t("new")}
              aria-description={t("select.or.create.session")}
              aria-label={t("new")}
              primaryTypographyProps={{
                sx: {
                  color: theme.palette.mode === "dark" ? theme.palette.common.white : undefined,
                  fontWeight: theme.palette.mode === "dark" ? 600 : undefined,
                },
              }}
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
                session.id === currentSessionId ? "action.selected" : "transparent",
              "&:hover": {
                backgroundColor: "action.hover",
              },
              transition: "none",
              "& .more-button": {
                opacity: 1,
                color: "text.disabled",
                transition: "opacity 0.15s ease-in-out",
              },
              "&:hover .more-button, &:focus-within .more-button": {
                opacity: 1,
                color: "text.primary",
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
              onClick={() => {
                dispatch(setCurrentSession(session.id));
                if (isMobile) {
                  // Match native drawer UX: selecting an item dismisses the drawer.
                  dispatch(closeMobileSidebar());
                }
              }}
              aria-current={session.id === currentSessionId ? "page" : undefined}
            >
              <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0 }}>
                <Typography
                  noWrap
                  sx={{ flexGrow: 1, overflow: "hidden", textOverflow: "ellipsis" }}
                >
                  {session.name}
                </Typography>
                <SyncStatusIndicator sessionId={session.id} variant="icon" />
              </Box>
            </ListItemButton>

            <IconButton
              id={`session-options-button-${session.id}`}
              className="more-button"
              onClick={(event) => handleMoreMenuClick(event, session.id)}
              aria-label={t('options')}
              aria-controls={moreMenuOpen ? "session-menu" : undefined}
              aria-expanded={moreMenuOpen && selectedSessionId === session.id ? "true" : undefined}
              aria-haspopup="true"
              sx={{
                minWidth: 44,
                minHeight: 44,
                mr: "10px",
                color: "inherit",
                "&:hover": { backgroundColor: "transparent" },
              }}
            >
              <Tooltip
                title={t('options')}
                placement="top"
                slotProps={{
                  popper: {
                    modifiers: [{ name: "offset", options: { offset: [0, 5] } }],
                  },
                }}
              >
                <MoreHorizIcon />
              </Tooltip>
            </IconButton>
          </ListItem>
        ))}

        {showLoadMoreButton && (
          <ListItem disablePadding>
            <ListItemButton
              id="load-more-sessions-button"
              disabled={isLoadingMoreSessions}
              onClick={() => {
                void dispatch(loadMoreSessionsFromStorage());
              }}
            >
              <ListItemIcon sx={{ minWidth: "0px", mr: "10px" }}>
                {isLoadingMoreSessions ? <CircularProgress size={16} /> : <MoreHorizIcon fontSize="small" />}
              </ListItemIcon>
              <ListItemText
                primary={isLoadingMoreSessions ? t("sidebar.loading.more") : t("sidebar.more")}
              />
            </ListItemButton>
          </ListItem>
        )}

        <Menu
          id="session-menu"
          MenuListProps={{
            "aria-label": t("options"),
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

      <SessionRenameDialog
        open={renameDialogOpen}
        initialValue={sessionToRename ? sessionName(sessionToRename) : ""}
        onClose={() => setRenameDialogOpen(false)}
        onRename={handleRenameSession}
      />

      <Box
        sx={{
          marginTop: "auto",
          display: "flex",
          justifyContent: "flex-start",
          px: 1,
          pb: 1,
        }}
      >
        <ProfileMenu
          size="30px"
          fontSize="12px"
          logout={() => console.log("logout")}
        />
      </Box>
    </Box>
  );

  if (isMobile) {
    return (
      <Drawer
        anchor="left"
        variant="temporary"
        open={isMobileSidebarOpen}
        onClose={() => dispatch(closeMobileSidebar())}
        ModalProps={{ keepMounted: true }}
      >
        {sidebarContent}
      </Drawer>
    );
  }

  if (isSidebarCollapsed) {
    // Desktop collapse means fully hidden, not icon-rail mode.
    return null;
  }

  return sidebarContent;
};

export default SessionSidebar;