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
    regenerateSourceMessage: {
      content: "Hello",
      attachments: undefined,
    },
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
    renderWithProviders(
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

  it("submits a like with the session and message IDs", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} />)

    fireEvent.click(screen.getByLabelText("good.response"))

    expect(submitResponseFeedback).toHaveBeenCalledWith("s1", "m1", true)
  })

  it("submits a dislike with the session and message IDs", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} />)

    fireEvent.click(screen.getByLabelText("bad.response"))

    expect(submitResponseFeedback).toHaveBeenCalledWith("s1", "m1", false)
  })

  it("does not dispatch regenerate without a matching user turn", () => {
    renderWithProviders(
      <ResponseButtons {...defaultProps} regenerateSourceMessage={undefined} />
    );

    const regenBtn = screen.getByLabelText("regenerate");
    fireEvent.click(regenBtn);

    expect(sendAssistantMessage).not.toHaveBeenCalled();
  });

  it("triggers clearResponseFeedback when clicking an already active feedback button", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} feedback="liked" />);
    
    const likeBtn = screen.getByLabelText("good.response");
    expect(likeBtn).toHaveAttribute("aria-pressed", "true");
    
    fireEvent.click(likeBtn);
    expect(clearResponseFeedback).toHaveBeenCalledWith("s1", "m1")
  });

  it("triggers clearResponseFeedback when clicking an already active dislike button", () => {
    renderWithProviders(
      <ResponseButtons {...defaultProps} feedback="disliked" />,
    )

    const dislikeButton = screen.getByLabelText("bad.response")

    expect(dislikeButton).toHaveAttribute("aria-pressed", "true")

    fireEvent.click(dislikeButton)

    expect(clearResponseFeedback).toHaveBeenCalledWith("s1", "m1")
  })
  it("switches from like to dislike", () => {
    renderWithProviders(<ResponseButtons {...defaultProps} feedback="liked" />)

    fireEvent.click(screen.getByLabelText("bad.response"))

    expect(submitResponseFeedback).toHaveBeenCalledWith("s1", "m1", false)
    expect(clearResponseFeedback).not.toHaveBeenCalled()
  })

  it("switches from dislike to like", () => {
    renderWithProviders(
      <ResponseButtons {...defaultProps} feedback="disliked" />,
    )

    fireEvent.click(screen.getByLabelText("good.response"))

    expect(submitResponseFeedback).toHaveBeenCalledWith("s1", "m1", true)
    expect(clearResponseFeedback).not.toHaveBeenCalled()
  })

  it("ignores a second reaction while feedback is pending", async () => {
    let resolveFeedback!: () => void

    const pendingFeedback = new Promise<void>((resolve) => {
      resolveFeedback = resolve
    })

    vi.mocked(submitResponseFeedback).mockImplementationOnce(() => async () => {
      await pendingFeedback
    })

    renderWithProviders(<ResponseButtons {...defaultProps} />)

    const likeButton = screen.getByLabelText("good.response")
    const dislikeButton = screen.getByLabelText("bad.response")

    fireEvent.click(likeButton)

    expect(likeButton).toBeDisabled()
    expect(dislikeButton).toBeDisabled()

    fireEvent.click(dislikeButton)

    expect(submitResponseFeedback).toHaveBeenCalledTimes(1)
    expect(clearResponseFeedback).not.toHaveBeenCalled()

    resolveFeedback()

    await waitFor(() => {
      expect(likeButton).not.toBeDisabled()
      expect(dislikeButton).not.toBeDisabled()
    })
  })
});
