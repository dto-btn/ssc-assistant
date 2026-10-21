/**
 * SessionSidebar component
 *
 * Displays the list of saved playground sessions, allows switching between
 * sessions and basic session management (rename, delete, export). Integrates
 * with the playground `sessionSlice`.
 */

import React, { useCallback, useState } from "react";
import { alpha } from "@mui/material";
import { List as ListWindow, RowComponentProps, useListRef } from "react-window";
import useMeasure from "react-use-measure";
import { useAppDispatch, useAppSelector } from "../store/hooks";
import {
  setCurrentSession,
  renameSession,
  type Session,
} from "../store/slices/sessionSlice";
import { startNewSession } from "../store/thunks/sessionThunks";
import {
  Chip,
  Divider,
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
} from "@mui/material";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import AddCommentIcon from "@mui/icons-material/AddComment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import CloseIcon from "@mui/icons-material/Close";
import { useTranslation } from 'react-i18next';
import { LEFT_MENU_EXPANDED_WIDTH } from "../constants";
import SessionRenameDialog from "./SessionRenameDialog";
import { selectSessionLastActivityById, selectSessionsNewestFirst } from "../store/selectors/sessionSelectors";
import { selectIsSessionWaitingById } from "../store/selectors/chatSelectors";
import SyncStatusIndicator from "./SyncStatusIndicator";
import ProfileMenu from "./ProfileMenu/ProfileMenu";
import { deleteSession as deleteSessionThunk, persistSessionRename } from "../store/thunks/sessionManagementThunks";
import { closeMobileSidebar } from "../store/slices/uiSlice";
import {
  CONVERSATION_BUCKET_LABEL_KEYS,
  getConversationBucket,
  formatConversationTimestamp,
  type ConversationBucket,
} from "../utils/chatTime";

const showCloudSyncIndicator = String(import.meta.env.VITE_PLAYGROUND_SHOW_CLOUD_SYNC_INDICATOR || "").toLowerCase() === "true";

const HEADER_ROW_HEIGHT = 30;
const SESSION_ROW_HEIGHT = 48;

type SidebarRow =
  | { kind: "header"; bucket: ConversationBucket }
  | { kind: "session"; session: Session; sessionIndex: number; lastActivity: number };

const visuallyHiddenSx = {
  position: "absolute",
  width: 1,
  height: 1,
  p: 0,
  m: -1,
  overflow: "hidden",
  clip: "rect(0 0 0 0)",
  whiteSpace: "nowrap",
  border: 0,
} as const;

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
  const { t, i18n } = useTranslation('playground');
  const sessions = useAppSelector((state) => state.sessions.sessions);
  const sessionsNewestFirst = useAppSelector(selectSessionsNewestFirst);
  const sessionLastActivityById = useAppSelector(selectSessionLastActivityById);
  const isSessionWaitingById = useAppSelector(selectIsSessionWaitingById);
  const currentSessionId = useAppSelector((state) => state.sessions.currentSessionId);
  const isSidebarCollapsed = useAppSelector(
    (state) => state.ui.isSidebarCollapsed
  );
  const isMobileSidebarOpen = useAppSelector(
    (state) => state.ui.isMobileSidebarOpen
  );
  const dispatch = useAppDispatch();
  const handleLogout = useCallback(() => console.log("logout"), []);

  const [renameDialogOpen, setRenameDialogOpen] = useState(false);
  const [sessionToRename, setSessionToRename] = useState<string | null>(null);
  const [moreMenuPosition, setMoreMenuPosition] = useState<{ top: number; left: number } | null>(null);
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
    dispatch(startNewSession());
  }, [dispatch]);

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
      const rect = event.currentTarget.getBoundingClientRect();
      setMoreMenuPosition({ top: rect.bottom, left: rect.left });
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
      setMoreMenuPosition(null);
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
    setMoreMenuPosition(null);
  }, [selectedSessionId]);

  const moreMenuOpen = Boolean(moreMenuPosition);

  const sidebarTitleId = "playground-session-sidebar-title";
  const sidebarNavLabel = t("sidebar.navigation");

  const [activeIndex, setActiveIndex] = useState(-1);
  const sessionOrderKey = sessionsNewestFirst.map((session) => session.id).join("|");
  // Bound the list to its own container so react-window can actually virtualize
  // (a height driven by row count renders every row and defeats overscanCount).
  const [listContainerRef, { height: listContainerHeight }] = useMeasure();
  const listRef = useListRef(null);

  const { rows, rowIndexBySessionIndex } = React.useMemo(() => {
    const nextRows: SidebarRow[] = [];
    const nextRowIndexBySessionIndex: number[] = [];
    const now = new Date();
    let previousBucket: ConversationBucket | null = null;
    sessionsNewestFirst.forEach((session, sessionIndex) => {
      const lastActivity = sessionLastActivityById[session.id] ?? session.createdAt;
      const bucket = getConversationBucket(lastActivity, now);
      if (bucket !== previousBucket) {
        nextRows.push({ kind: "header", bucket });
        previousBucket = bucket;
      }
      nextRowIndexBySessionIndex.push(nextRows.length);
      nextRows.push({ kind: "session", session, sessionIndex, lastActivity });
    });
    return { rows: nextRows, rowIndexBySessionIndex: nextRowIndexBySessionIndex };
  }, [sessionLastActivityById, sessionsNewestFirst]);

  const getRowHeight = useCallback(
    (index: number) => (rows[index]?.kind === "header" ? HEADER_ROW_HEIGHT : SESSION_ROW_HEIGHT),
    [rows],
  );

  const activateSession = useCallback((sessionId: string) => {
    dispatch(setCurrentSession(sessionId));
    if (isMobile) {
      // Match native drawer UX: selecting an item dismisses the drawer.
      dispatch(closeMobileSidebar());
    }
  }, [dispatch, isMobile]);

  React.useEffect(() => {
    if (!sessionsNewestFirst.length) {
      setActiveIndex(-1);
      return;
    }

    const currentIndex = currentSessionId
      ? sessionsNewestFirst.findIndex((session) => session.id === currentSessionId)
      : -1;

    setActiveIndex(currentIndex >= 0 ? currentIndex : 0);
  }, [currentSessionId, sessionOrderKey, sessionsNewestFirst]);

  React.useEffect(() => {
    if (activeIndex < 0) {
      return;
    }

    const rowIndex = rowIndexBySessionIndex[activeIndex];
    if (rowIndex === undefined) {
      return;
    }

    // Keep the bucket header visible when the first session of a group is active.
    const previousRow = rows[rowIndex - 1];
    listRef.current?.scrollToRow({
      index: previousRow?.kind === "header" ? rowIndex - 1 : rowIndex,
      align: "smart",
    });
    listRef.current?.scrollToRow({ index: rowIndex, align: "smart" });
  }, [activeIndex, listRef, rowIndexBySessionIndex, rows]);

  const handleSessionListKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!sessionsNewestFirst.length) {
      return;
    }

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        setActiveIndex((previous) => Math.min(previous + 1, sessionsNewestFirst.length - 1));
        return;
      case "ArrowUp":
        event.preventDefault();
        setActiveIndex((previous) => Math.max(previous - 1, 0));
        return;
      case "Home":
        event.preventDefault();
        setActiveIndex(0);
        return;
      case "End":
        event.preventDefault();
        setActiveIndex(sessionsNewestFirst.length - 1);
        return;
      case "Enter":
      case " ": {
        // If the event originated from a child interactive element (e.g., the
        // Options "..." button), let it handle its own keyboard activation.
        if (event.target !== event.currentTarget) {
          return;
        }
        event.preventDefault();
        const activeSession = activeIndex >= 0 ? sessionsNewestFirst[activeIndex] : undefined;
        if (activeSession) {
          activateSession(activeSession.id);
        }
        return;
      }
      default:
        return;
    }
  }, [activeIndex, activateSession, sessionsNewestFirst]);

  const chatItemRender = useCallback(({ index, style }: RowComponentProps) => {
    const row = rows[index];
    if (!row) {
      return null;
    }

    if (row.kind === "header") {
      return (
        <Box
          component="li"
          role="presentation"
          data-testid={`session-bucket-${row.bucket}`}
          style={style}
          sx={{
            listStyle: "none",
            display: "flex",
            alignItems: "flex-end",
            boxSizing: "border-box",
            px: 1.25,
            pb: 0.5,
          }}
        >
          <Typography
            component="h3"
            variant="caption"
            sx={{ color: "text.secondary", fontWeight: 700, lineHeight: 1.2, m: 0 }}
          >
            {t(CONVERSATION_BUCKET_LABEL_KEYS[row.bucket])}
          </Typography>
        </Box>
      );
    }

    const { session, sessionIndex, lastActivity } = row;
    const isActiveOption = sessionIndex === activeIndex;
    const isWaitingForAssistant = Boolean(isSessionWaitingById[session.id]);
    const waitingDescriptionId = `session-waiting-status-${session.id}`;
    const lastActivityDescriptionId = `session-last-activity-${session.id}`;
    const lastActivityLabel = t("sidebar.lastActivity", {
      time: formatConversationTimestamp(lastActivity, undefined, i18n.language),
    });
    const describedBy = [
      lastActivityDescriptionId,
      isWaitingForAssistant ? waitingDescriptionId : null,
    ].filter(Boolean).join(" ");

    return (
      <ListItem
        key={session.id}
        component="li"
        disablePadding
        style={style}
        sx={{
          listStyle: "none",
          display: "flex",
          flexDirection: "row",
          alignItems: "center",
          p: "0px",
          outline: isActiveOption ? "2px solid" : "2px solid transparent",
          outlineColor: isActiveOption ? "primary.main" : "transparent",
          outlineOffset: -2,
          backgroundColor: session.id === currentSessionId ? "action.selected" : "transparent",
          boxSizing: "border-box",
          width: "100%",
          border: "1px solid transparent",
          transition: "background-color 0.15s ease, border-color 0.15s ease",
          "&:hover": {
            backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
            borderColor: "primary.light",
          },
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
        <Box component="span" id={lastActivityDescriptionId} sx={visuallyHiddenSx}>
          {lastActivityLabel}
        </Box>
        <Tooltip
          describeChild
          placement="right"
          enterDelay={400}
          enterNextDelay={200}
          title={
            <Box sx={{ maxWidth: 280 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, overflowWrap: "anywhere" }}>
                {session.name}
              </Typography>
              <Typography variant="caption" component="div">
                {lastActivityLabel}
              </Typography>
              {isWaitingForAssistant && (
                <Typography variant="caption" component="div">
                  {t("sidebar.waitingForResponse")}
                </Typography>
              )}
            </Box>
          }
        >
          <ListItemButton
            id={`session-button-${session.id}`}
            disableRipple
            tabIndex={-1}
            sx={{
              padding: "5px 10px",
              minWidth: 0,
              alignSelf: "stretch",
              "&:hover": { backgroundColor: "transparent" },
            }}
            onClick={() => activateSession(session.id)}
            aria-current={session.id === currentSessionId ? "page" : undefined}
            aria-describedby={describedBy}
          >
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, width: "100%", minWidth: 0 }}>
              <Typography
                data-testid={`session-title-${session.id}`}
                data-waiting-for-response={isWaitingForAssistant ? "true" : "false"}
                noWrap
                sx={{
                  flexGrow: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  fontWeight: isWaitingForAssistant ? 700 : 400,
                  transition: "font-weight 0.15s ease-in-out",
                }}
              >
                {session.name}
              </Typography>
              {isWaitingForAssistant && (
                <Box component="span" id={waitingDescriptionId} sx={visuallyHiddenSx}>
                  {t("sidebar.waitingForResponse")}
                </Box>
              )}
              {isWaitingForAssistant && (
                <Box
                  component="span"
                  aria-label={t("sidebar.waitingForResponse")}
                  sx={{
                    width: 8,
                    height: 8,
                    minWidth: 8,
                    minHeight: 8,
                    flexShrink: 0,
                    boxSizing: "border-box",
                    borderRadius: "50%",
                    backgroundColor: "info.main",
                    display: "inline-block",
                    boxShadow: "0 0 0 0 rgba(2, 136, 209, 0.7)",
                    animation: "session-waiting-pulse 1.5s ease-in-out infinite",
                    "@keyframes session-waiting-pulse": {
                      "0%": { boxShadow: "0 0 0 0 rgba(2, 136, 209, 0.45)" },
                      "70%": { boxShadow: "0 0 0 6px rgba(2, 136, 209, 0)" },
                      "100%": { boxShadow: "0 0 0 0 rgba(2, 136, 209, 0)" },
                    },
                    "@media (prefers-reduced-motion: reduce)": {
                      animation: "none",
                      boxShadow: "none",
                    },
                  }}
                />
              )}
              {showCloudSyncIndicator && (
                <SyncStatusIndicator sessionId={session.id} variant="icon" />
              )}
            </Box>
          </ListItemButton>
        </Tooltip>

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
    );
  }, [activeIndex, activateSession, currentSessionId, handleMoreMenuClick, i18n.language, isSessionWaitingById, moreMenuOpen, rows, selectedSessionId, t]);

  const sidebarContent = (
    <Box
      component="nav"
      id="playground-session-sidebar"
      aria-label={sidebarNavLabel}
      sx={{
        width: LEFT_MENU_EXPANDED_WIDTH,
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflowX: "hidden",
        // Fallback scroll: at extreme zoom, 100dvh can shrink to less than the
        // fixed-height header/button/divider need, squeezing the list toward 0.
        // The list has its own minHeight floor below, so when that floor plus
        // the fixed items exceeds 100dvh, this lets the whole nav scroll to it.
        overflowY: "auto",
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

      <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
        <Box key="newChat">
          <ListItemButton 
            id="new-chat-button" 
            onClick={handleNewSession} 
            aria-label={t("new.chat.aria")}
            sx={{
              px: 1,
              py: 0.75,
              transition: "background-color 0.15s ease",
              boxSizing: 'border-box',
              borderTop: "1px solid transparent",
              borderBottom: "1px solid transparent",
              "&:hover": {
                backgroundColor: (theme) => alpha(theme.palette.primary.main, 0.08),
                borderTop: "1px solid",
                borderBottom: "1px solid",
                borderColor: "primary.light",
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: "0px", mr: "10px" }}>
              <AddCommentIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={t("new")}
              aria-description={t("select.or.create.session")}
              aria-label={t("new")}
            />
          </ListItemButton>
        </Box>

        <ListItem component="div" sx={{ py: 1 }}>
          <Divider sx={{ width: "100%" }}>
            <Chip label={t("chats")} size="small" sx={{ backgroundColor: "transparent" }} />
          </Divider>
        </ListItem>

        <Box ref={listContainerRef} sx={{ flex: 1, minHeight: SESSION_ROW_HEIGHT * 3 }}>
          <ListWindow
            listRef={listRef}
            role="list"
            aria-labelledby={sidebarTitleId}
            onFocus={() => {
              if (activeIndex < 0 && sessionsNewestFirst.length > 0) {
                setActiveIndex(0);
              }
            }}
            onKeyDown={handleSessionListKeyDown}
            overscanCount={5}
            rowHeight={getRowHeight}
            rowCount={rows.length}
            rowComponent={chatItemRender}
            rowProps={{}}
            tabIndex={0}
            tagName="ul"
            style={{ width: "100%", height: listContainerHeight, listStyle: "none", padding: 0, margin: 0 }}
          />
        </Box>

        <Menu
          id="session-menu"
          MenuListProps={{
            "aria-label": t("options"),
            "aria-labelledby": selectedSessionId ? `session-options-button-${selectedSessionId}` : undefined,
          }}
          anchorReference="anchorPosition"
          anchorPosition={moreMenuPosition ?? { top: 0, left: 0 }}
          open={moreMenuOpen}
          onClose={() => setMoreMenuPosition(null)}
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
      </Box>

      <SessionRenameDialog
        open={renameDialogOpen}
        initialValue={sessionToRename ? sessionName(sessionToRename) : ""}
        onClose={() => setRenameDialogOpen(false)}
        onRename={handleRenameSession}
      />

      {!isMobile && (
        <Box
          sx={{
            marginTop: "auto",
            flexShrink: 0,
            display: "flex",
            justifyContent: "flex-start",
            alignItems: "center",
            width: "100%",
            borderTop: "1px solid",
            borderColor: "divider",
            bgcolor: "background.default",
            px: 1,
            pt: 1,
            pb: 1,
          }}
        >
          <ProfileMenu
            size="30px"
            fontSize="12px"
            logout={handleLogout}
          />
        </Box>
      )}
    </Box>
  );

  if (isMobile) {
    return (
      <>
        <Drawer
          anchor="left"
          variant="temporary"
          open={isMobileSidebarOpen}
          onClose={() => dispatch(closeMobileSidebar())}
        >
          {sidebarContent}
        </Drawer>
        {isMobileSidebarOpen && (
          <Box
            sx={{
              position: "fixed",
              left: LEFT_MENU_EXPANDED_WIDTH + 8,
              bottom: 12,
              zIndex: 1300,
              "& #profile-menu-button": {
                width: "auto",
                minWidth: 0,
                px: 0.75,
                py: 0.75,
                border: "1px solid",
                borderColor: "divider",
                borderRadius: "999px",
                bgcolor: "background.paper",
                boxShadow: 2,
              },
              "& #profile-menu-button .MuiTypography-root": {
                display: "none",
              },
            }}
          >
            <ProfileMenu
              size="30px"
              fontSize="12px"
              logout={handleLogout}
            />
          </Box>
        )}
      </>
    );
  }

  if (isSidebarCollapsed) {
    // Desktop collapse means fully hidden, not icon-rail mode.
    return null;
  }

  return sidebarContent;
};

export default SessionSidebar;