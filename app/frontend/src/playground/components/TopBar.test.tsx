import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import TopBar from "./TopBar";
import uiReducer from "../store/slices/uiSlice";

const mockChangeLanguage = vi.fn();

vi.mock("react-i18next", async () => {
  return {
    useTranslation: () => ({
      t: (key: string) => (key === "title" ? "SSC Assistant" : key),
      i18n: {
        language: 'en',
        changeLanguage: mockChangeLanguage,
      }
    }),
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
  it("renders branding and title", () => {
    renderTopBar(true);
    expect(screen.getByText("SSC Assistant")).toBeInTheDocument();
    expect(screen.getByAltText("SSC Logo")).toBeInTheDocument();
    expect(screen.getByTestId("dev-banner")).toBeInTheDocument();
  });

  it("shows collapse icon and correct accessibility label when sidebar is open", () => {
    renderTopBar(true);
    const button = screen.getByRole("button", { name: "sidebar.collapse" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("MenuOpenIcon")).toBeInTheDocument();
  });

  it("shows expand icon and correct accessibility label when sidebar is closed", () => {
    renderTopBar(false);
    const button = screen.getByRole("button", { name: "sidebar.open" });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByTestId("MenuIcon")).toBeInTheDocument();
  });

  it("calls onToggleSidebar when toggle button is clicked", async () => {
    const onToggle = vi.fn();
    const user = userEvent.setup();
    renderTopBar(true, onToggle);

    await user.click(screen.getByRole("button", { name: "sidebar.collapse" }));
    expect(onToggle).toHaveBeenCalled();
  });

  it("renders Teams join chat button with correct link", async () => {
    const windowSpy = vi.spyOn(window, "open").mockImplementation(() => null);
    const user = userEvent.setup();
    renderTopBar(true);
    
    const teamsButton = screen.getByRole("button", { name: /button.joinchat/i });
    expect(teamsButton).toBeInTheDocument();
    
    await user.click(teamsButton);
    expect(windowSpy).toHaveBeenCalledWith(expect.stringContaining("teams.microsoft.com"), "_blank");
    windowSpy.mockRestore();
  });

  it("toggles language when language button is clicked", async () => {
    const user = userEvent.setup();
    renderTopBar(true);
    
    // Initial display based on mock 'en'
    const langButton = screen.getByRole("button", { name: /passer au français/i });
    expect(langButton).toHaveTextContent("EN");
    
    await user.click(langButton);
    expect(mockChangeLanguage).toHaveBeenCalledWith("fr");
  });
});
