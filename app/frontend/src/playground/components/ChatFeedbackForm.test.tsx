import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { ThemeProvider, createTheme } from "@mui/material";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ChatFeedbackForm from "./ChatFeedbackForm";
import { submitChatFeedback } from "../store/thunks/feedbackThunks";
import { uploadFile } from "../api/storage"

vi.mock("../store/thunks/feedbackThunks", () => ({
  submitChatFeedback: vi.fn((payload) => ({
    type: "mock/submitChatFeedback",
    payload,
  })),
}));

vi.mock("../api/storage", () => ({
  uploadFile: vi.fn(),
}))

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { count?: number; max?: number }) => {
      if (key === "chat.feedback.attachments.selected") {
        return `${options?.count} file(s) selected`;
      }

      if (key === "chat.feedback.attachments.limit.exceeded") {
        return `You selected more than ${options?.max} files. Only the first ${options?.max} were kept.`;
      }

      return key;
    },
  }),
}));

const theme = createTheme();
const onClose = vi.fn();

function renderForm() {
  const store = configureStore({
    reducer: () => ({ auth: { accessToken: "test-access-token" } }),
  })

  return render(
    <Provider store={store}>
      <ThemeProvider theme={theme}>
        <ChatFeedbackForm
          open
          onClose={onClose}
          messageId="message-1"
          sessionId="session-1"
        />
      </ThemeProvider>
    </Provider>,
  );
}

describe("ChatFeedbackForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("provides an accessible dialog, feedback choices, and return navigation", () => {
    renderForm();

    const dialog = screen.getByRole("dialog", {
      name: "chat.feedback.title",
    });
    expect(dialog).toHaveAttribute(
      "aria-describedby",
      "chat-feedback-dialog-subtitle",
    );

    const issueButton = screen.getByRole("button", {
      name: "chat.feedback.report.issue",
    });
    const suggestionButton = screen.getByRole("button", {
      name: "chat.feedback.suggestion",
    });
    expect(issueButton).toHaveAttribute(
      "aria-describedby",
      "feedback-issue-description",
    );
    expect(suggestionButton).toHaveAttribute(
      "aria-describedby",
      "feedback-suggestion-description",
    );

    act(() => {
      suggestionButton.focus();
    });
    expect(suggestionButton).toHaveFocus();
    fireEvent.click(suggestionButton);

    expect(
      screen.getByRole("button", { name: "chat.feedback.back" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveFocus();
  });

  it("submits issue feedback with trimmed required fields", async () => {
    renderForm()

    fireEvent.click(
      screen.getByRole("button", { name: "chat.feedback.report.issue" }),
    )
    const [descriptionInput, stepsInput] = screen.getAllByRole("textbox")
    fireEvent.change(descriptionInput, {
      target: { value: "  The answer cited an outdated policy.  " },
    })
    fireEvent.change(stepsInput, {
      target: { value: "  Ask about the current policy.  " },
    })
    fireEvent.click(screen.getByRole("button", { name: "submit" }))

    await waitFor(() => {
      expect(submitChatFeedback).toHaveBeenCalledWith({
        messageId: "message-1",
        sessionId: "session-1",
        type: "issue",
        description: "The answer cited an outdated policy.",
        stepsToReproduce: "Ask about the current policy.",
        attachments: [],
      })
      expect(onClose).toHaveBeenCalledOnce()
    })
  })

  it("shows required validation and keeps the dialog open for an incomplete issue", () => {
    renderForm();

    fireEvent.click(
      screen.getByRole("button", { name: "chat.feedback.report.issue" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "submit" }));

    expect(
      screen.getByText("chat.feedback.issue.description.required"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("chat.feedback.issue.steps.required"),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("textbox")[0]).toHaveFocus();
    expect(submitChatFeedback).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("uploads accepted image attachments before submitting suggestion feedback", async () => {
    const uploadedAttachment = {
      blobName: "user-id/feedback/session-1/message-1/policy.png",
      url: "https://storage.example/feedback/policy.png",
      originalName: "policy.png",
      size: 5,
      contentType: "image/png",
      sessionId: "session-1",
      category: "feedback",
    }
    vi.mocked(uploadFile).mockResolvedValue(uploadedAttachment)

    renderForm()

    fireEvent.click(
      screen.getByRole("button", { name: "chat.feedback.suggestion" }),
    )
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "Add links to related policy sections." },
    })

    const upload = screen
      .getByRole("button", { name: "chat.feedback.attachments.choose" })
      .querySelector<HTMLInputElement>('input[type="file"]')
    expect(upload).not.toBeNull()
    const acceptedImage = new File(["image"], "policy.png", {
      type: "image/png",
    })
    const rejectedFile = new File(["document"], "policy.pdf", {
      type: "application/pdf",
    })
    fireEvent.change(upload!, {
      target: { files: [acceptedImage, rejectedFile] },
    })
    fireEvent.click(screen.getByRole("button", { name: "submit" }))

    await waitFor(() => {
      expect(uploadFile).toHaveBeenCalledWith({
        file: acceptedImage,
        accessToken: "test-access-token",
        sessionId: "session-1",
        category: "feedback",
        metadata: { messageId: "message-1" },
      })
    })

    await waitFor(() => {
      expect(submitChatFeedback).toHaveBeenCalledWith({
        messageId: "message-1",
        sessionId: "session-1",
        type: "suggestion",
        description: "Add links to related policy sections.",
        attachments: [uploadedAttachment],
      })
    })

    expect(
      screen.getAllByText("chat.feedback.attachments.invalid.type"),
    ).not.toHaveLength(0)
  })
});
