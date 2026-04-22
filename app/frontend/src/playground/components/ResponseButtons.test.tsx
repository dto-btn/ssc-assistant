import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import React from "react";
import { ThemeProvider, createTheme } from "@mui/material";

import ResponseButtons from "./ResponseButtons";
import chatReducer from "../store/slices/chatSlice";
import { sendAssistantMessage } from "../store/thunks/assistantThunks";
import { submitResponseFeedback, clearResponseFeedback } from "../store/thunks/feedbackThunks";

// Mock the thunks
vi.mock("../store/thunks/assistantThunks", () => ({
  sendAssistantMessage: vi.fn(() => ({ type: "mock/sendAssistantMessage" })),
}));

vi.mock("../store/thunks/feedbackThunks", () => ({
  submitResponseFeedback: vi.fn(() => ({ type: "mock/submitResponseFeedback" })),
  clearResponseFeedback: vi.fn(() => ({ type: "mock/clearResponseFeedback" })),
}));

// Mock i18next
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const theme = createTheme();

function renderWithProviders(ui: React.ReactElement) {
  const store = configureStore({
    reducer: {
      chat: chatReducer,
    },
  });

  return {
    ...render(
      <Provider store={store}>
        <ThemeProvider theme={theme}>
          {ui}
        </ThemeProvider>
      </Provider>
    ),
    store,
  };
}

describe("ResponseButtons", () => {
  const defaultProps = {
    isHovering: true,
    isMostRecent: true,
    text: "Assistant response",
    messageId: "m1",
    isStreaming: false,
    messages: [
      { id: "u1", role: "user" as const, content: "Hello", sessionId: "s1", timestamp: 1 },
      { id: "m1", role: "assistant" as const, content: "Assistant response", sessionId: "s1", timestamp: 2 },
    ],
    sessionId: "s1",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Support clipboard API
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockImplementation(() => Promise.resolve()),
      },
    });
  });

  it("renders all buttons when visible", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} />);
    
    expect(screen.getByLabelText("copy")).toBeInTheDocument();
    expect(screen.getByLabelText("regenerate")).toBeInTheDocument();
    expect(screen.getByLabelText("good.response")).toBeInTheDocument();
    expect(screen.getByLabelText("bad.response")).toBeInTheDocument();
  });

  it("hides buttons when not visible (Issue 3)", () => {
    const { container } = renderWithProviders(
      <ResponseButtons {...defaultProps} isHovering={false} isMostRecent={false} />
    );
    
    // The main group should have display: none
    const group = screen.getByRole("group", { hidden: true });
    expect(group).toHaveStyle({ display: "none" });
  });

  it("copies text to clipboard when copy button is clicked", async () => {
    renderWithProviders(<ResponseButtons {...defaultProps} />);
    
    const copyBtn = screen.getByLabelText("copy");
    fireEvent.click(copyBtn);
    
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("Assistant response");
    
    // Should show success icon/label
    await waitFor(() => {
      expect(screen.getByLabelText("copy.success")).toBeInTheDocument();
    });
  });

  it("triggers regenerate thunk with correct parameters (Issue 1)", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} />);
    
    const regenBtn = screen.getByLabelText("regenerate");
    fireEvent.click(regenBtn);
    
    expect(sendAssistantMessage).toHaveBeenCalledWith(expect.objectContaining({
      sessionId: "s1",
      content: "Hello",
      skipUserMessage: true,
      deleteMessageId: "m1",
    }));
  });

  it("triggers feedback thunks correctly (Issue 2 persistence fix)", () => {
    const { rerender } = renderWithProviders(<ResponseButtons {...defaultProps} />);
    
    const likeBtn = screen.getByLabelText("good.response");
    fireEvent.click(likeBtn);
    expect(submitResponseFeedback).toHaveBeenCalledWith("m1", true);

    const dislikeBtn = screen.getByLabelText("bad.response");
    fireEvent.click(dislikeBtn);
    expect(submitResponseFeedback).toHaveBeenCalledWith("m1", false);
  });

  it("triggers clearResponseFeedback when clicking an already active feedback button", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} feedback="liked" />);
    
    const likeBtn = screen.getByLabelText("good.response");
    expect(likeBtn).toHaveAttribute("aria-pressed", "true");
    
    fireEvent.click(likeBtn);
    expect(clearResponseFeedback).toHaveBeenCalledWith("m1");
  });
});
