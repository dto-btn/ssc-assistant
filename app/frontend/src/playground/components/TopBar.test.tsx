import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { useTranslation } from "react-i18next";

import TopBar from "./TopBar";
import uiReducer from "../store/slices/uiSlice";

const mockChangeLanguage = vi.fn();

vi.mock("react-i18next", () => {
  return {
    useTranslation: vi.fn(() => ({
      t: (key: string) => (key === "title" ? "SSC Assistant" : key),
      i18n: {
        language: 'en',
        changeLanguage: mockChangeLanguage,
      }
    })),
  };
});

vi.mock("./DevBanner", () => ({
  DevBanner: () => <div data-testid="dev-banner" />
}));

vi.mock("../../assets/SSC-Logo-Purple-Leaf-300x300.png", () => ({
  default: "logo-url"
}));

vi.mock("./TopmenuMicrosofTeamsIcon.svg", () => ({
  default: "teams-icon-url"
}));

function renderTopBar(isSidebarOpen: boolean, onToggle?: () => void) {
  const store = configureStore({
    reducer: {
      ui: uiReducer,
    },
  });

  render(
    <Provider store={store as never}>
      <TopBar isSidebarOpen={isSidebarOpen} onToggleSidebar={onToggle} />
    </Provider>
  );

  return store;
}

describe("TopBar", () => {
  /**
   * Test that the TopBar renders the essential branding elements:
   * - App Title (SSC Assistant)
   * - Logo (with correct alt text)
   * - Development Banner (if configured)
   */
  it("renders branding and title", () => {
    renderTopBar(true);
    expect(screen.getByText("SSC Assistant")).toBeInTheDocument();
    expect(screen.getByAltText("logo.alt")).toBeInTheDocument();
    expect(screen.getByTestId("dev-banner")).toBeInTheDocument();
  });

  /**
   * Test that the sidebar toggle button displays the "collapse" state 
   * and correct ARIA attributes when the sidebar is currently open.
   */
  it("shows collapse icon and correct accessibility label when sidebar is open", () => {
    renderTopBar(true);
    const button = screen.getByRole("button", { name: "sidebar.collapse" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("MenuOpenIcon")).toBeInTheDocument();
  });

  /**
   * Test that the sidebar toggle button displays the "expand" state
   * and correct ARIA attributes when the sidebar is currently closed/collapsed.
   */
  it("shows expand icon and correct accessibility label when sidebar is closed", () => {
    renderTopBar(false);
    const button = screen.getByRole("button", { name: "sidebar.open" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("MenuIcon")).toBeInTheDocument();
  });

  /**
   * Test that clicking the sidebar toggle icon triggers the provided
   * callback function (used for collapsing/expanding the navigation).
   */
  it("calls onToggleSidebar when toggle button is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderTopBar(true, onToggle);

    await user.click(screen.getByRole("button", { name: "sidebar.collapse" }));
    expect(onToggle).toHaveBeenCalled();
  });

  /**
   * Test that the Teams external link button renders correctly and
   * opens the expected URL with secure window attributes (noopener, noreferrer).
   */
  it("renders Teams join chat button with correct link", async () => {
    const windowSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    renderTopBar(true);
    
    const teamsButton = screen.getByRole("button", { name: /button.joinchat/i });
    expect(teamsButton).toBeInTheDocument();
    
    await user.click(teamsButton);
    expect(windowSpy).toHaveBeenCalledWith(
      expect.stringContaining("teams.microsoft.com"),
      "_blank",
      "noopener,noreferrer"
    );
    windowSpy.mockRestore();
  });

  /**
   * Test that clicking the language toggle changes the application language
   * (e.g., from English to French).
   */
  it("toggles language when language button is clicked", async () => {
    const user = userEvent.setup();
    renderTopBar(true);
    
    // Initial display based on mock 'en'
    const langButton = screen.getByRole("button", { name: /passer au français/i });
    expect(langButton).toHaveTextContent("EN");
    
    await user.click(langButton);
    expect(mockChangeLanguage).toHaveBeenCalledWith("fr");
  });

  /**
   * Test that the language toggle button shows correct ARIA labels 
   * when the active language is French (switching to English).
   */
  it("should have correct aria-label for language toggle when language is fr", async () => {
    mockChangeLanguage.mockReset();
    vi.mocked(useTranslation).mockReturnValue({
      t: (key: string) => (key === "title" ? "SSC Assistant" : key),
      i18n: {
        language: 'fr',
        changeLanguage: mockChangeLanguage,
      }
    } as any);

    renderTopBar(true);
    const langButton = screen.getByRole("button", { name: /switch to english/i });
    expect(langButton).toBeInTheDocument();
    expect(langButton).toHaveTextContent("FR");
  });
});
