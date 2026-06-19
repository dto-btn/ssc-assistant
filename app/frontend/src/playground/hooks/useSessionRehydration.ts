/**
 * useSessionRehydration
 *
 * Manages the lifecycle of session archive rehydration:
 * - Fetches session file lists when a session becomes active.
 * - Detects when the remote archive version has changed vs the locally-loaded one.
 * - Dispatches rehydrateSessionFromArchive with appropriate force flag.
 * - Tracks in-progress rehydrations to avoid concurrent dispatches for the same session.
 * - Exposes a boolean `isRehydrated` flag so UI can hide the stale-content loader.
 *
 * Extracted from ChatArea.tsx to keep that component focused on layout/export.
 */

import React from "react";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "../store";
import { useAppSelector } from "../store/hooks";
import { selectCurrentSessionFiles } from "../store/selectors/sessionFilesSelectors";
import { listSessionFiles } from "../api/storage";
import { setSessionFiles } from "../store/slices/sessionFilesSlice";
import { rehydrateSessionFromArchive } from "../store/thunks/sessionBootstrapThunks";
import { pickLatestArchive } from "../utils/archives";
import { applyRemoteSessionDeletion } from "../store/thunks/sessionManagementThunks";
import { selectMessagesForSession } from "../store/selectors/chatSelectors";

export interface UseSessionRehydrationReturn {
  /** True once the initial rehydration attempt (or skip) has completed. */
  isRehydrated: boolean;
}

export function useSessionRehydration(
  currentSessionId: string | null,
): UseSessionRehydrationReturn {
  const dispatch = useDispatch<AppDispatch>();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const sessionFiles = useAppSelector(selectCurrentSessionFiles);
  const syncEntries = useAppSelector((state) => state.sync.byId);
  const messages = useAppSelector((state) =>
    currentSessionId ? selectMessagesForSession(state, currentSessionId) : [],
  );

  // Refs track rehydration state without causing re-renders on every update.
  const rehydratedSessionsRef = React.useRef<Set<string>>(new Set());
  const rehydratingSessionsRef = React.useRef<Set<string>>(new Set());
  const hydratedArchiveVersionRef = React.useRef<Map<string, string | null>>(new Map());
  const fetchedSessionsRef = React.useRef<Set<string>>(new Set());

  const [rehydratedSessionIds, setRehydratedSessionIds] = React.useState<Record<string, boolean>>({});

  const markSessionRehydrated = React.useCallback((sessionId: string) => {
    if (rehydratedSessionsRef.current.has(sessionId)) return;
    rehydratedSessionsRef.current.add(sessionId);
    setRehydratedSessionIds((prev) =>
      prev[sessionId] ? prev : { ...prev, [sessionId]: true },
    );
  }, []);

  const clearSessionRehydrated = React.useCallback((sessionId: string) => {
    rehydratedSessionsRef.current.delete(sessionId);
    setRehydratedSessionIds((prev) => {
      if (!prev[sessionId]) return prev;
      const next = { ...prev };
      delete next[sessionId];
      return next;
    });
  }, []);

  const latestRemoteArchive = React.useMemo(
    () => pickLatestArchive(sessionFiles),
    [sessionFiles],
  );

  // Fetch session file list whenever the active session or auth token changes.
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
        const latestVersion: string | null =
          latestArchive?.lastUpdated ?? latestArchive?.uploadedAt ?? null;

        fetchedSessionsRef.current.add(currentSessionId);

        const hydratedVersion =
          hydratedArchiveVersionRef.current.get(currentSessionId) ?? null;
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

  const currentSyncStatus = currentSessionId
    ? syncEntries[currentSessionId]?.status
    : undefined;

  // Rehydrate when a session is opened or when the remote archive version changes.
  React.useEffect(() => {
    if (!currentSessionId) return undefined;
    if (rehydratingSessionsRef.current.has(currentSessionId)) return undefined;

    const remoteVersion = fetchedSessionsRef.current.has(currentSessionId)
      ? (latestRemoteArchive?.lastUpdated ?? latestRemoteArchive?.uploadedAt ?? null)
      : undefined;
    const hydratedVersion =
      hydratedArchiveVersionRef.current.get(currentSessionId) ?? null;
    const hasMessages = messages.length > 0;
    const hasPendingLocal =
      currentSyncStatus === "pending" ||
      currentSyncStatus === "syncing" ||
      currentSyncStatus === "error";

    if (hasPendingLocal) return undefined;

    const remoteVersionKnown = remoteVersion !== undefined;
    const remoteChanged = remoteVersionKnown && remoteVersion !== hydratedVersion;
    const needsInitialHydration =
      !hasMessages && !rehydratedSessionsRef.current.has(currentSessionId);

    if (!needsInitialHydration && !remoteChanged) return undefined;
    if (!remoteVersionKnown && !needsInitialHydration) return undefined;

    rehydratingSessionsRef.current.add(currentSessionId);
    let cancelled = false;

    (async () => {
      try {
        const result = await dispatch(
          rehydrateSessionFromArchive(currentSessionId, { force: remoteChanged }),
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
  }, [
    currentSessionId,
    currentSyncStatus,
    dispatch,
    latestRemoteArchive,
    markSessionRehydrated,
    messages.length,
  ]);

  const isRehydrated = currentSessionId
    ? (rehydratedSessionIds[currentSessionId] ?? false)
    : true;

  return { isRehydrated };
}
