import { describe, expect, it } from "vitest";

import {
  THIRTY_DAYS_MS,
  acceptPlaygroundDisclaimer,
  getNextPlaygroundDisclaimer,
  isDisclaimerAcceptanceCurrent,
} from "./disclaimerState";

describe("playground disclaimer state", () => {
  const now = 1_700_000_000_000;

  it("requires assistant disclaimer first", () => {
    const next = getNextPlaygroundDisclaimer({}, now);
    expect(next).toBe("assistant");
  });

  it("requires BR disclaimer after assistant acceptance", () => {
    const withAssistantAccepted = acceptPlaygroundDisclaimer("assistant", {}, now);
    const next = getNextPlaygroundDisclaimer(withAssistantAccepted, now + 1_000);
    expect(next).toBe("br");
  });

  it("returns null when both disclaimers were accepted within 30 days", () => {
    const withAssistantAccepted = acceptPlaygroundDisclaimer("assistant", {}, now);
    const withBothAccepted = acceptPlaygroundDisclaimer("br", withAssistantAccepted, now + 1_000);
    const next = getNextPlaygroundDisclaimer(withBothAccepted, now + 2_000);
    expect(next).toBeNull();
  });

  it("keeps disclaimers valid for 30 days", () => {
    const acceptedAt = now - (THIRTY_DAYS_MS - 1);
    expect(isDisclaimerAcceptanceCurrent(acceptedAt, now)).toBe(true);
  });

  it("expires disclaimers at 30 days", () => {
    const acceptedAt = now - THIRTY_DAYS_MS;
    expect(isDisclaimerAcceptanceCurrent(acceptedAt, now)).toBe(false);
  });
});