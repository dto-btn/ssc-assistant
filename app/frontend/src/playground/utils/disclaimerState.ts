export type PlaygroundDisclaimerKey = "assistant" | "br";

export interface PlaygroundDisclaimerState {
  assistantAcceptedAt?: number;
  brAcceptedAt?: number;
}

export const PLAYGROUND_DISCLAIMER_STORAGE_KEY = "playground_disclaimer_state_v1";
export const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

const isFiniteTimestamp = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value) && value >= 0;

const parseState = (raw: string | null): PlaygroundDisclaimerState => {
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const state: PlaygroundDisclaimerState = {};

    if (isFiniteTimestamp(parsed.assistantAcceptedAt)) {
      state.assistantAcceptedAt = parsed.assistantAcceptedAt;
    }

    if (isFiniteTimestamp(parsed.brAcceptedAt)) {
      state.brAcceptedAt = parsed.brAcceptedAt;
    }

    return state;
  } catch {
    return {};
  }
};

export const loadPlaygroundDisclaimerState = (): PlaygroundDisclaimerState => {
  return parseState(localStorage.getItem(PLAYGROUND_DISCLAIMER_STORAGE_KEY));
};

export const savePlaygroundDisclaimerState = (state: PlaygroundDisclaimerState): void => {
  localStorage.setItem(PLAYGROUND_DISCLAIMER_STORAGE_KEY, JSON.stringify(state));
};

export const isDisclaimerAcceptanceCurrent = (
  acceptedAt: number | undefined,
  now: number,
): boolean => {
  if (!isFiniteTimestamp(acceptedAt)) {
    return false;
  }

  return now - acceptedAt < THIRTY_DAYS_MS;
};

export const getNextPlaygroundDisclaimer = (
  state: PlaygroundDisclaimerState,
  now: number,
): PlaygroundDisclaimerKey | null => {
  const needsAssistantDisclaimer = !isDisclaimerAcceptanceCurrent(state.assistantAcceptedAt, now);
  if (needsAssistantDisclaimer) {
    return "assistant";
  }

  const needsBrDisclaimer = !isDisclaimerAcceptanceCurrent(state.brAcceptedAt, now);
  if (needsBrDisclaimer) {
    return "br";
  }

  return null;
};

export const acceptPlaygroundDisclaimer = (
  key: PlaygroundDisclaimerKey,
  state: PlaygroundDisclaimerState,
  now: number,
): PlaygroundDisclaimerState => {
  if (key === "assistant") {
    return {
      ...state,
      assistantAcceptedAt: now,
    };
  }

  return {
    ...state,
    brAcceptedAt: now,
  };
};