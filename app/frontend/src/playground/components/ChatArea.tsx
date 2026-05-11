/**
 * ChatArea component
 *
 * Renders the main chat area for the playground including messages and
 * metadata such as citations and feedback controls. Exports a React
 * component used by `PlaygroundRoot`/`Playground`.
 *
 * Embeds orchestrator activity/debug panels and keeps archive rehydration in
 * sync when remote session files change.
 */

import React from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import ChatMessages from "./ChatMessages";
import ChatInput from "./ChatInput";
import { Box, Typography, useTheme, useMediaQuery, CircularProgress } from "@mui/material";
import Suggestions from "./Suggestions";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import { selectCurrentSessionFiles } from "../store/selectors/sessionFilesSelectors";
import { useTranslation } from 'react-i18next';
import { listSessionFiles } from "../api/storage";
import { setSessionFiles } from "../store/slices/sessionFilesSlice";
import { rehydrateSessionFromArchive } from "../store/thunks/sessionBootstrapThunks";
import { pickLatestArchive } from "../utils/archives";
import { applyRemoteSessionDeletion } from "../store/thunks/sessionManagementThunks";
import { sendAssistantMessage } from "../store/thunks/assistantThunks";
import OrchestratorDebugPanel from "./OrchestratorDebugPanel";
import TopBar from "./TopBar";
import { useAppSelector } from "../store/hooks";
import type { PaletteMode } from "@mui/material";

/**
 * Optional controls passed from layout so ChatArea can reopen a hidden sidebar.
 */
interface ChatAreaProps {
  onOpenSidebar?: () => void;
  isSidebarOpen?: boolean;
  themeMode: PaletteMode;
  onToggleTheme: () => void;
}

const ChatArea: React.FC<ChatAreaProps> = ({
  onOpenSidebar,
  isSidebarOpen,
  themeMode,
  onToggleTheme,
}) => {
  const { t } = useTranslation('playground');
  const dispatch = useDispatch<AppDispatch>();
  const currentSessionId = useAppSelector(
    (state) => state.sessions.currentSessionId
  );
  const isLoading = useAppSelector((state) =>
    currentSessionId ? (state.chat.isLoadingBySessionId[currentSessionId] ?? false) : false
  );
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const syncEntries = useAppSelector((state) => state.sync.byId);
  const rehydratedSessionsRef = React.useRef<Set<string>>(new Set());
  const rehydratingSessionsRef = React.useRef<Set<string>>(new Set());
  const hydratedArchiveVersionRef = React.useRef<Map<string, string | null>>(new Map());
  const fetchedSessionsRef = React.useRef<Set<string>>(new Set());
  const [rehydratedSessionIds, setRehydratedSessionIds] = React.useState<Record<string, boolean>>({});

  // Use memoized selector for messages
  const messages = useAppSelector(selectMessagesBySessionId);
  const sessionFiles = useAppSelector(selectCurrentSessionFiles);
  const isNewChat = useAppSelector((state) => 
    state.sessions.sessions.find(s => s.id === currentSessionId)?.isNewChat ?? false
  );
  const markSessionRehydrated = React.useCallback((sessionId: string) => {
    if (rehydratedSessionsRef.current.has(sessionId)) {
      return;
    }

    rehydratedSessionsRef.current.add(sessionId);
    setRehydratedSessionIds((previous) => (
      previous[sessionId]
        ? previous
        : { ...previous, [sessionId]: true }
    ));
  }, []);
  const clearSessionRehydrated = React.useCallback((sessionId: string) => {
    rehydratedSessionsRef.current.delete(sessionId);
    setRehydratedSessionIds((previous) => {
      if (!previous[sessionId]) {
        return previous;
      }

      const next = { ...previous };
      delete next[sessionId];
      return next;
    });
  }, []);
  const latestRemoteArchive = React.useMemo(
    () => pickLatestArchive(sessionFiles),
    [sessionFiles]
  );

  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const isMobileSidebarOpen = useAppSelector((state) => state.ui.isMobileSidebarOpen);

  /**
   * Renders the brand TopBar with sidebar toggle.
   */
  const renderHeader = () => {
    return (
      <Box display="flex" alignItems="center" width="100%">
        <Box flexGrow={1}>
          <TopBar 
            onToggleSidebar={onOpenSidebar} 
            isSidebarOpen={isSidebarOpen}
            isMobile={isMobile}
            isMobileSidebarOpen={isMobileSidebarOpen}
            themeMode={themeMode}
            onToggleTheme={onToggleTheme}
          />
        </Box>
      </Box>
    );
  };

  /**
   * Convert a canned suggestion into a user turn for quick-start prompts.
   */
  const handleSuggestion = (suggestion: string): void => {
    dispatch(
      sendAssistantMessage({
        sessionId: currentSessionId!,
        content: suggestion,
      })
    );
  };

  // Load persisted attachments each time a session becomes active so we can
  // detect remote updates and keep local state fresh.
  React.useEffect(() => {
    if (!currentSessionId || !accessToken) return undefined;

    let cancelled = false;
    (async () => {
      try {
        console.debug("Loading session files", { sessionId: currentSessionId });
        const result = await listSessionFiles({ sessionId: currentSessionId, accessToken });
        if (cancelled) return;
        if (result.deletedSessionIds.length) {
          result.deletedSessionIds
            .filter((id) => id && id !== currentSessionId)
            .forEach((id) => {
              void dispatch(applyRemoteSessionDeletion(id, { silent: true }));
            });
        }
        if (result.sessionDeleted) {
          clearSessionRehydrated(currentSessionId);
          rehydratingSessionsRef.current.delete(currentSessionId);
          hydratedArchiveVersionRef.current.delete(currentSessionId);
          fetchedSessionsRef.current.delete(currentSessionId);
          void dispatch(applyRemoteSessionDeletion(currentSessionId));
          return;
        }
        const files = result.files;
        dispatch(setSessionFiles({ sessionId: currentSessionId, files }));
        const latestArchive = pickLatestArchive(files);
        const latestVersion: string | null = latestArchive?.lastUpdated ?? latestArchive?.uploadedAt ?? null;
        fetchedSessionsRef.current.add(currentSessionId);
        const hydratedVersion = hydratedArchiveVersionRef.current.get(currentSessionId) ?? null;
        if (hydratedVersion !== latestVersion) {
          clearSessionRehydrated(currentSessionId);
        }
        console.debug("Loaded session files", {
          sessionId: currentSessionId,
          fileCount: files.length,
          latestVersion,
        });
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to load session files", error);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, clearSessionRehydrated, currentSessionId, dispatch]);

  const currentSyncStatus = currentSessionId ? syncEntries[currentSessionId]?.status : undefined;

  // Automatically rehydrate archived chats when a session is opened or when the
  // remote archive version changes.
  React.useEffect(() => {
    if (!currentSessionId) return undefined;
    if (rehydratingSessionsRef.current.has(currentSessionId)) return undefined;

    const remoteVersion = fetchedSessionsRef.current.has(currentSessionId)
      ? (latestRemoteArchive?.lastUpdated ?? latestRemoteArchive?.uploadedAt ?? null)
      : undefined;
    const hydratedVersion = hydratedArchiveVersionRef.current.get(currentSessionId) ?? null;
    const hasMessages = messages.length > 0;
    const hasPendingLocal = currentSyncStatus === "pending" || currentSyncStatus === "syncing" || currentSyncStatus === "error";
    if (hasPendingLocal) return undefined;

    const remoteVersionKnown = remoteVersion !== undefined;
    const remoteChanged = remoteVersionKnown && remoteVersion !== hydratedVersion;
    const needsInitialHydration = !hasMessages && !rehydratedSessionsRef.current.has(currentSessionId);

    if (!needsInitialHydration && !remoteChanged) {
      return undefined;
    }

    if (!remoteVersionKnown && !needsInitialHydration) {
      return undefined;
    }

    rehydratingSessionsRef.current.add(currentSessionId);
    let cancelled = false;

    (async () => {
      try {
        const result = await dispatch(
          rehydrateSessionFromArchive(currentSessionId, { force: remoteChanged })
        );
        if (cancelled) return;

        const latestVersion =
          result?.latestVersion !== undefined
            ? result.latestVersion
            : (remoteVersion ?? null);

        fetchedSessionsRef.current.add(currentSessionId);

        if (result?.restored) {
          hydratedArchiveVersionRef.current.set(currentSessionId, latestVersion);
          markSessionRehydrated(currentSessionId);
        } else if (!(result?.hasArchive ?? false)) {
          hydratedArchiveVersionRef.current.set(currentSessionId, null);
          markSessionRehydrated(currentSessionId);
        } else if (latestVersion === hydratedVersion) {
          markSessionRehydrated(currentSessionId);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to restore chat archive", error);
        }
      } finally {
        rehydratingSessionsRef.current.delete(currentSessionId);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentSessionId, currentSyncStatus, dispatch, latestRemoteArchive, markSessionRehydrated, messages.length]);

  if (!currentSessionId) {
    return (
      <Box flex={1} display="flex" flexDirection="column" height="100dvh">
        {renderHeader()}
        <Box flex={1} display="flex" alignItems="center" justifyContent="center">
          {t("select.or.create.session")}
        </Box>
      </Box>
    );
  }

  // Hydration state check:
  // If we have messages, always show messages.
  // If no messages but it's an old chat that hasn't finished hydrating yet, show a loader.
  const isHydrating =
    Boolean(accessToken)
    && !isNewChat
    && messages.length === 0
    && !rehydratedSessionIds[currentSessionId];

  if (isHydrating) {
    return (
      <Box flex={1} display="flex" flexDirection="column" height="100dvh">
        {renderHeader()}
        <Box flex={1} display="flex" flexDirection="column" alignItems="center" justifyContent="center">
          <CircularProgress size={40} sx={{ mb: 2 }} />
          <Typography variant="body1" color="text.secondary">
            {t("loading.chat", { defaultValue: "Restoring chat history..." })}
          </Typography>
        </Box>
      </Box>
    );
  }

  if (messages.length === 0) {
    return (
      <Box
        flex={1}
        display="flex"
        flexDirection="column"
        height="100dvh"
      >
        {renderHeader()}
        <Box flex={1} display="flex" flexDirection="column" alignItems="center" justifyContent="center" p={{ xs: 2, sm: 4, md: 6 }}>
          <Typography variant="h3" gutterBottom>
            {t("how.can.i.help")}
          </Typography>
          <Typography
            component="p"
            variant="body1"
            align="center"
            sx={{
              width: "100%",
              maxWidth: { xs: "100%", sm: "600px", md: "800px" },
              mb: { xs: 2, sm: 3, md: 4 },
              px: { xs: 1, sm: 2 },
              lineHeight: 1.7,
              color: "text.primary",
            }}
          >
            {t("how.can.i.help.description")}
          </Typography>
          <Suggestions
            onSuggestionClicked={handleSuggestion}
            disabled={isLoading}
          />
          <OrchestratorDebugPanel sessionId={currentSessionId} />
        </Box>
        <ChatInput sessionId={currentSessionId} />
      </Box>
    );
  }

  return (
    <Box flex={1} display="flex" flexDirection="column" height="100dvh">
      {renderHeader()}
      <ChatMessages sessionId={currentSessionId} />
      <OrchestratorDebugPanel sessionId={currentSessionId} />
      <ChatInput sessionId={currentSessionId} />
    </Box>
  );
};

export default ChatArea;