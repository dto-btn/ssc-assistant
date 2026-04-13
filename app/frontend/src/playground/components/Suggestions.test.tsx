import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import Suggestions from "./Suggestions";

/**
 * Unit Tests for the Suggestions Component
 * 
 * This file contains isolated unit tests for the `Suggestions` UI component.
 * It verifies that the component correctly renders the expected number of cards,
 * displays translated content, handles disabled states, and triggers callbacks.
 */

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Suggestions Component", () => {
  /**
   * Verifies that exactly 6 suggestion cards are rendered.
   * This ensures the layout meets the design requirement of showing a fixed set of options.
   */
  it("renders 6 suggestion cards", () => {
    render(<Suggestions onSuggestionClicked={() => {}} />);
    
    // MUI Grid items by default don't always expose listitem role unless specifically role="listitem" is added
    // Let's check for 6 button surfaces (CardActionArea) instead
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);
  });

  /**
   * Verifies that clicking a suggestion card correctly invokes the `onSuggestionClicked` callback.
   * This is critical for ensuring user interactions are bubbled up to the parent component.
   */
  it("calls onSuggestionClicked with the translated title when a card is clicked", async () => {
    const onSuggestionClicked = vi.fn();
    const user = userEvent.setup();
    
    render(<Suggestions onSuggestionClicked={onSuggestionClicked} />);
    
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);
    
    // Click the first suggestion
    await user.click(buttons[0]);
    
    expect(onSuggestionClicked).toHaveBeenCalledTimes(1);
    expect(onSuggestionClicked).toHaveBeenCalledWith(expect.any(String));
  });

  /**
   * Verifies that all buttons are disabled when the `disabled` prop is passed.
   * This prevents users from triggering actions during loading or error states.
   */
  it("disables all cards when the disabled prop is true", () => {
    render(<Suggestions onSuggestionClicked={() => {}} disabled={true} />);
    
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  /**
   * Ensures every suggestion card has an `aria-label`.
   * This is a fundamental check for ensuring the component is accessible to screen readers.
   */
  it("has correct accessibility attributes", () => {
    render(<Suggestions onSuggestionClicked={() => {}} />);
    
    // Material UI CardActionArea uses buttons
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("aria-label");
    });
  });

  /**
   * Verifies that the UI correctly groups suggestions into categories.
   * Confirms that category labels (translated keys) are visible to the user.
   */
  it("renders distinct categories for suggestions", () => {
    render(<Suggestions onSuggestionClicked={() => {}} />);
    
    const chips = screen.getAllByText(/suggestions\.categories\./);
    expect(chips.length).toBeGreaterThan(0);
  });
});
