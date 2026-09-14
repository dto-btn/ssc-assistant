import { renderHook } from "@testing-library/react";
import { describe, expect, it, beforeEach } from "vitest";

import { useInertRoot } from "./useInertRoot";

describe("useInertRoot", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div><div id="modal-root" aria-hidden="true"></div>';
  });

  it("marks #root inert while active and clears it on unmount", () => {
    const { unmount } = renderHook(() => useInertRoot(true));

    const root = document.getElementById("root") as HTMLElement & { inert: boolean };
    expect(root.inert).toBe(true);
    expect(document.getElementById("modal-root")?.hasAttribute("aria-hidden")).toBe(false);

    unmount();
    expect(root.inert).toBe(false);
  });

  it("does not mutate #root when inactive", () => {
    renderHook(() => useInertRoot(false));

    const root = document.getElementById("root") as HTMLElement & { inert: boolean };
    expect(root.inert).not.toBe(true);
  });

  it("keeps #root inert until every concurrent caller has released it", () => {
    const first = renderHook(() => useInertRoot(true));
    const second = renderHook(() => useInertRoot(true));

    const root = document.getElementById("root") as HTMLElement & { inert: boolean };
    expect(root.inert).toBe(true);

    // One caller unmounting should not un-gate the root while another still needs it.
    first.unmount();
    expect(root.inert).toBe(true);

    second.unmount();
    expect(root.inert).toBe(false);
  });
});
