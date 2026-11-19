import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppSnackbars } from "./AppSnackbar";
import { useAppStore } from "../stores/AppStore";

describe("AppSnackbars", () => {
  afterEach(() => {
    act(() => {
      useAppStore.setState((state) => ({
        snackbars: { ...state.snackbars, data: [], debounceKeys: [] },
      }));
    });
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it("announces informational notifications as a polite status", () => {
    vi.useFakeTimers();
    useAppStore.getState().snackbars.show("Suggestion opened", undefined, "info");
    render(<AppSnackbars />);

    expect(screen.getByRole("status")).toHaveTextContent("Suggestion opened");
  });
});
