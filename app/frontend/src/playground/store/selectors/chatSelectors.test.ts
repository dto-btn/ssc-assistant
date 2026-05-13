import { describe, expect, it } from "vitest";
import type { RootState } from "../../store";
import {
  selectAssistantResponsePhaseForSession,
  selectIsSessionWaitingForAssistant,
  selectIsSessionWaitingById,
} from "./chatSelectors";

const makeState = (overrides?: {
  isLoadingBySessionId?: Record<string, boolean>;
  assistantResponsePhaseBySessionId?: Record<string, "idle" | "waiting-first-token" | "drafting" | "streaming" | undefined>;
}): RootState =>
  ({
    chat: {
      messages: [],
      isLoadingBySessionId: overrides?.isLoadingBySessionId ?? {},
      assistantResponsePhaseBySessionId: overrides?.assistantResponsePhaseBySessionId ?? {},
      orchestratorInsightsBySessionId: {},
    },
  }) as unknown as RootState;

describe("chatSelectors waiting state", () => {
  it("returns idle phase when no session is provided", () => {
    const state = makeState();

    expect(selectAssistantResponsePhaseForSession(state, null)).toBe("idle");
  });

  it("returns false waiting state when no session is provided", () => {
    const state = makeState();

    expect(selectIsSessionWaitingForAssistant(state, null)).toBe(false);
  });

  it("marks waiting-first-token phase as waiting", () => {
    const state = makeState({
      assistantResponsePhaseBySessionId: { s1: "waiting-first-token" },
    });

    expect(selectAssistantResponsePhaseForSession(state, "s1")).toBe("waiting-first-token");
    expect(selectIsSessionWaitingForAssistant(state, "s1")).toBe(true);
  });

  it("marks drafting and streaming phases as waiting", () => {
    const draftingState = makeState({
      assistantResponsePhaseBySessionId: { s1: "drafting" },
    });
    const streamingState = makeState({
      assistantResponsePhaseBySessionId: { s1: "streaming" },
    });

    expect(selectIsSessionWaitingForAssistant(draftingState, "s1")).toBe(true);
    expect(selectIsSessionWaitingForAssistant(streamingState, "s1")).toBe(true);
  });

  it("marks session loading as waiting even when phase is idle", () => {
    const state = makeState({
      isLoadingBySessionId: { s1: true },
      assistantResponsePhaseBySessionId: { s1: "idle" },
    });

    expect(selectIsSessionWaitingForAssistant(state, "s1")).toBe(true);
  });

  it("returns false when loading is false and phase is idle", () => {
    const state = makeState({
      isLoadingBySessionId: { s1: false },
      assistantResponsePhaseBySessionId: { s1: "idle" },
    });

    expect(selectAssistantResponsePhaseForSession(state, "s1")).toBe("idle");
    expect(selectIsSessionWaitingForAssistant(state, "s1")).toBe(false);
  });

  it("builds waiting flags by session id", () => {
    const state = makeState({
      isLoadingBySessionId: { s1: true },
      assistantResponsePhaseBySessionId: { s2: "streaming", s3: "idle" },
    });

    expect(selectIsSessionWaitingById(state)).toEqual({
      s1: true,
      s2: true,
      s3: false,
    });
  });
});
