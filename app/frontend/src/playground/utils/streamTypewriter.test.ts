import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createStreamTypewriter } from "./streamTypewriter";

describe("createStreamTypewriter", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("streams progressively when reduced motion is not requested", () => {
    const updates: string[] = [];
    vi.spyOn(window, "matchMedia").mockImplementation(
      ((query: string) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia,
    );

    const typewriter = createStreamTypewriter({
      tickMs: 20,
      charsPerTick: 2,
      onUpdate: (text) => updates.push(text),
    });

    typewriter.enqueue("hello");

    expect(updates).toHaveLength(0);

    vi.advanceTimersByTime(20);
    expect(updates).toEqual(["he"]);

    vi.advanceTimersByTime(40);
    expect(updates.at(-1)).toBe("hello");
  });

  it("flushes immediately when reduced motion is requested", () => {
    const updates: string[] = [];
    vi.spyOn(window, "matchMedia").mockImplementation(
      ((query: string) => ({
        matches: query === "(prefers-reduced-motion: reduce)",
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })) as unknown as typeof window.matchMedia,
    );

    const typewriter = createStreamTypewriter({
      charsPerTick: 3,
      onUpdate: (text) => updates.push(text),
    });

    typewriter.enqueue("abcdef");

    expect(typewriter.getDisplayedText()).toBe("abcdef");
    expect(updates.at(-1)).toBe("abcdef");
  });
});
