import { createSelector } from "reselect";
import type { RootState } from "../index";
import type { Session } from "../slices/sessionSlice";

const selectSessions = (state: RootState) => state.sessions.sessions;

export const selectSessionsNewestFirst = createSelector(
  [selectSessions],
  (sessions: Session[]) => [...sessions].sort((a, b) => b.createdAt - a.createdAt)
);
