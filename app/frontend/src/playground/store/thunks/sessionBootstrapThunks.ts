/**
 * Session bootstrap thunks
 *
 * Helpers that discover archived sessions stored in Azure Blob Storage and
 * recreate their local metadata so chat history can be rehydrated without
 * requiring an existing local session record.
 */

import { fetchFileDataUrl, listSessionFiles } from "../../api/storage";
import type { AppThunk } from "..";
import type { Session } from "../slices/sessionSlice";
import { addSession, setCurrentSession } from "../slices/sessionSlice";
import { setSessionFiles } from "../slices/sessionFilesSlice";
import { hydrateSessionMessages, type Message } from "../slices/chatSlice";
import type { FileAttachment } from "../../types";
import {
  decodeArchiveDataUrl,
  isChatArchiveAttachment,
  normalizeArchiveMessage,
  pickLatestArchive,
} from "../../utils/archives";
import { applyRemoteSessionDeletion } from "./sessionManagementThunks";

export interface SessionRehydrationResult {
  restored: boolean;
  hasArchive: boolean;
  latestVersion: string | null;
}

export interface RehydrateSessionOptions {
  force?: boolean;
}

export const rehydrateSessionFromArchive = (
  sessionId: string,
  options?: RehydrateSessionOptions,
): AppThunk<Promise<SessionRehydrationResult>> =>
  async (dispatch, getState) => {
    if (!sessionId) {
      return { restored: false, hasArchive: false, latestVersion: null };
    }

    const state = getState();
    const accessToken = state.auth.accessToken;
    if (!accessToken?.trim()) {
      return { restored: false, hasArchive: false, latestVersion: null };
    }

    const hasExistingMessages = state.chat.messages.some((message) => message.sessionId === sessionId);
    const shouldSkipHydration = hasExistingMessages && !options?.force;
    if (shouldSkipHydration) {
      const cachedFiles = state.sessionFiles.bySessionId?.[sessionId] ?? [];
      const cachedArchives = cachedFiles.filter(isChatArchiveAttachment);
      const latestCachedArchive = pickLatestArchive(cachedArchives);
      const latestVersion = latestCachedArchive?.lastUpdated ?? latestCachedArchive?.uploadedAt ?? null;
      return {
        restored: false,
        hasArchive: cachedArchives.length > 0,
        latestVersion,
      };
    }

    let files = state.sessionFiles.bySessionId?.[sessionId] ?? [];
    let sessionDeleted = false;
    if (!files.length) {
      try {
        const result = await listSessionFiles({ accessToken, sessionId });
        files = result.files;
        sessionDeleted = result.sessionDeleted;
        if (result.deletedSessionIds.length) {
          result.deletedSessionIds
            .filter((id) => id && id !== sessionId)
            .forEach((id) => {
              void dispatch(applyRemoteSessionDeletion(id, { silent: true }));
            });
        }
        if (sessionDeleted) {
          void dispatch(applyRemoteSessionDeletion(sessionId, { silent: true }));
          return { restored: false, hasArchive: false, latestVersion: null };
        }
        dispatch(setSessionFiles({ sessionId, files }));
      } catch (error) {
        console.error("Failed to list files for session", { sessionId, error });
        return { restored: false, hasArchive: false, latestVersion: null };
      }
    }

    if (sessionDeleted) {
      return { restored: false, hasArchive: false, latestVersion: null };
    }

    const chatArchives = files.filter(isChatArchiveAttachment);
    if (!chatArchives.length) {
      return { restored: false, hasArchive: false, latestVersion: null };
    }

    const latestArchive = pickLatestArchive(chatArchives);
    const latestVersion: string | null = latestArchive?.lastUpdated ?? latestArchive?.uploadedAt ?? null;
    if (!latestArchive || (!latestArchive.url && !latestArchive.blobName)) {
      return { restored: false, hasArchive: true, latestVersion };
    }

    try {
      const { dataUrl } = await fetchFileDataUrl({
        fileUrl: latestArchive.url ?? undefined,
        blobName: latestArchive.blobName ?? undefined,
        fileType: latestArchive.contentType ?? undefined,
        accessToken,
      });
      if (!dataUrl) {
        return { restored: false, hasArchive: true, latestVersion };
      }

      const decoded = decodeArchiveDataUrl(dataUrl);
      const parsed = JSON.parse(decoded) as { messages?: unknown[] };
      const restoredMessages = Array.isArray(parsed.messages)
        ? parsed.messages
            .map((entry) => normalizeArchiveMessage(entry, sessionId))
            .filter((msg): msg is Message => Boolean(msg))
        : [];

      if (!restoredMessages.length) {
        return { restored: false, hasArchive: true, latestVersion };
      }

      dispatch(hydrateSessionMessages({ sessionId, messages: restoredMessages }));
      return { restored: true, hasArchive: true, latestVersion };
    } catch (error) {
      console.error("Failed to rehydrate session archive", { sessionId, error });
      return { restored: false, hasArchive: true, latestVersion };
    }
  };

const buildRecoveredName = (sessionId: string, uploadedAtMs: number, providedName?: string | null) => {
  if (providedName && providedName.trim().length > 0) {
    return providedName.trim();
  }
  if (Number.isFinite(uploadedAtMs) && uploadedAtMs > 0) {
    const localeLabel = new Date(uploadedAtMs).toLocaleString();
    return `Recovered chat ${localeLabel}`;
  }
  return `Recovered chat ${sessionId.slice(0, 8)}`;
};

export const bootstrapSessionsFromStorage = (): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const state = getState();
  const accessToken = state.auth.accessToken;
  if (!accessToken?.trim()) {
    return;
  }

  let files: FileAttachment[];
  try {
    const result = await listSessionFiles({ accessToken });
    files = result.files;
    if (result.deletedSessionIds.length) {
      result.deletedSessionIds.forEach((sessionId) => {
        if (sessionId) {
          void dispatch(applyRemoteSessionDeletion(sessionId, { silent: true }));
        }
      });
    }
  } catch (error) {
    console.error("Failed to enumerate remote session files", error);
    return;
  }

  if (!files.length) {
    return;
  }

  const grouped = new Map<string, { files: FileAttachment[]; latestTimestamp: number; sessionName?: string | null }>();
  for (const file of files) {
    const sessionId = file.sessionId ?? undefined;
    if (!sessionId) {
      continue;
    }
    const record = grouped.get(sessionId) ?? { files: [], latestTimestamp: 0, sessionName: file.sessionName };
    record.files.push(file);
    const timestampSource = file.lastUpdated || file.uploadedAt;
    const uploadedAtMs = timestampSource ? Date.parse(timestampSource) : Number.NaN;
    if (Number.isFinite(uploadedAtMs) && uploadedAtMs > record.latestTimestamp) {
      record.latestTimestamp = uploadedAtMs;
      if (file.sessionName) {
        record.sessionName = file.sessionName;
      }
    }
    if (!record.sessionName && file.sessionName) {
      record.sessionName = file.sessionName;
    }
    grouped.set(sessionId, record);
  }

  if (!grouped.size) {
    return;
  }

  const existingSessions = new Map(state.sessions.sessions.map((session) => [session.id, session]));
  const newSessions: Session[] = [];

  const restorationTargets: string[] = [];

  grouped.forEach((value, sessionId) => {
    if (value.files.length === 0) {
      return;
    }
    restorationTargets.push(sessionId);
    dispatch(setSessionFiles({ sessionId, files: value.files }));
    if (!existingSessions.has(sessionId)) {
      const createdAt = Number.isFinite(value.latestTimestamp) && value.latestTimestamp > 0
        ? value.latestTimestamp
        : Date.now();
      newSessions.push({
        id: sessionId,
        name: buildRecoveredName(sessionId, createdAt, value.sessionName),
        createdAt,
      });
    }
  });

  if (!newSessions.length) {
    restorationTargets.forEach((sessionId) => {
      void dispatch(rehydrateSessionFromArchive(sessionId));
    });
    return;
  }

  newSessions.sort((a, b) => a.createdAt - b.createdAt);
  newSessions.forEach((session) => dispatch(addSession(session)));

  const newestSessionId = newSessions[newSessions.length - 1]?.id;
  if (newestSessionId) {
    dispatch(setCurrentSession(newestSessionId));
  }

  restorationTargets.forEach((sessionId) => {
    void dispatch(rehydrateSessionFromArchive(sessionId));
  });
};
