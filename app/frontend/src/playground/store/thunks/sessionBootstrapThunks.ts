/**
 * Session bootstrap thunks
 *
 * Helpers that discover archived sessions stored in Azure Blob Storage and
 * recreate their local metadata so chat history can be rehydrated without
 * requiring an existing local session record.
 */

import { listSessionFiles } from "../../api/storage";
import type { AppThunk } from "..";
import type { Session } from "../slices/sessionSlice";
import { addSession, setCurrentSession } from "../slices/sessionSlice";
import { setSessionFiles } from "../slices/sessionFilesSlice";
import type { FileAttachment } from "../../types";

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
    files = await listSessionFiles({ accessToken });
  } catch (error) {
    // eslint-disable-next-line no-console
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

  grouped.forEach((value, sessionId) => {
    if (value.files.length === 0) {
      return;
    }
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
    return;
  }

  newSessions.sort((a, b) => a.createdAt - b.createdAt);
  newSessions.forEach((session) => dispatch(addSession(session)));

  const newestSessionId = newSessions[newSessions.length - 1]?.id;
  if (newestSessionId) {
    dispatch(setCurrentSession(newestSessionId));
  }
};
