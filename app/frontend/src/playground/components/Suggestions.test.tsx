import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect } from "vitest";
import Suggestions from "./Suggestions";

// Mock react-i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

describe("Suggestions Component", () => {
  it("renders 6 suggestion cards", () => {
    render(<Suggestions onSuggestionClicked={() => {}} />);
    
    // MUI Grid items by default don't always expose listitem role unless specifically role="listitem" is added
    // Let's check for 6 button surfaces (CardActionArea) instead
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(6);
  });

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

  it("disables all cards when the disabled prop is true", () => {
    render(<Suggestions onSuggestionClicked={() => {}} disabled={true} />);
    
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toBeDisabled();
    });
  });

  it("has correct accessibility attributes", () => {
    render(<Suggestions onSuggestionClicked={() => {}} />);
    
    // Material UI CardActionArea uses buttons
    const buttons = screen.getAllByRole("button");
    buttons.forEach((button) => {
      expect(button).toHaveAttribute("aria-label");
    });
  });

  it("renders distinct categories for suggestions", () => {
    render(<Suggestions onSuggestionClicked={() => {}} />);
    
    const chips = screen.getAllByText(/suggestions\.categories\./);
    expect(chips.length).toBeGreaterThan(0);
  });
});
