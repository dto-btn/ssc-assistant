import { createSelector } from "reselect";
import { RootState } from "../../store";
import { TokenUsageMetrics } from "../../types";

const selectMessages = (state: RootState) => state.chat.messages;
const selectCurrentSessionId = (state: RootState) => state.sessions.currentSessionId;

type TokenUsageTotals = TokenUsageMetrics & { hasUsage: boolean };

export interface SessionTokenUsageSummary {
  totals: TokenUsageTotals;
  lastCall?: TokenUsageMetrics;
}

const initialTotals: TokenUsageTotals = {
  promptTokens: 0,
  completionTokens: 0,
  totalTokens: 0,
  model: undefined,
  provider: undefined,
  timestamp: undefined,
  hasUsage: false,
};

export const selectSessionTokenUsageSummary = createSelector(
  [selectMessages, selectCurrentSessionId],
  (messages, sessionId): SessionTokenUsageSummary => {
    if (!sessionId) {
      return { totals: { ...initialTotals } };
    }

    const totals: TokenUsageTotals = { ...initialTotals };
    let lastCall: TokenUsageMetrics | undefined;

    for (const message of messages) {
      if (message.sessionId !== sessionId || !message.tokenUsage) {
        continue;
      }

      totals.promptTokens += message.tokenUsage.promptTokens;
      totals.completionTokens += message.tokenUsage.completionTokens;
      totals.totalTokens += message.tokenUsage.totalTokens;
      totals.model = message.tokenUsage.model ?? totals.model;
      totals.provider = message.tokenUsage.provider ?? totals.provider;
      totals.timestamp = message.tokenUsage.timestamp ?? totals.timestamp;
      totals.hasUsage = true;
      lastCall = message.tokenUsage;
    }

    return { totals, lastCall };
  }
);
