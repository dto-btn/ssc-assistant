import { describe, expect, it, vi, beforeEach } from "vitest";
import { configureStore } from "@reduxjs/toolkit";
import chatReducer from "../slices/chatSlice";
import toastReducer from "../slices/toastSlice";
import modelReducer from "../slices/modelSlice";
import { selectMessagesForSession } from "../selectors/chatSelectors";
import { generateAssistantImage } from "./imageThunks";
import { completionService } from "../../services/completionService";
import { uploadEncodedFile } from "../../api/storage";
import { isTokenExpired } from "../../../util/token";

vi.mock("../../../util/token", () => ({
  isTokenExpired: vi.fn(() => false),
}));

vi.mock("../../services/completionService", () => ({
  completionService: {
    generateImage: vi.fn(),
  },
}));

vi.mock("../../api/storage", () => ({
  uploadEncodedFile: vi.fn(),
}));

vi.mock("../../../i18n", () => ({
  default: { t: (key: string) => key },
}));

const generateImageMock = vi.mocked(completionService.generateImage);
const uploadEncodedFileMock = vi.mocked(uploadEncodedFile);
const isTokenExpiredMock = vi.mocked(isTokenExpired);

const makeStore = (accessToken: string | null = "valid-token") => {
  const authReducer = (state = { accessToken }) => state;

  return configureStore({
    reducer: {
      chat: chatReducer,
      toast: toastReducer,
      models: modelReducer,
      auth: authReducer,
    } as any,
  });
};

describe("generateAssistantImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isTokenExpiredMock.mockReturnValue(false);
  });

  it("uploads the generated image and attaches it to the assistant message", async () => {
    const store = makeStore();
    generateImageMock.mockResolvedValue({
      images: [{ b64Json: "ZmFrZS1pbWFnZS1kYXRh", revisedPrompt: "a friendly robot" }],
      provider: "azure-openai",
    });
    uploadEncodedFileMock.mockResolvedValue({
      blobName: "blob/generated.png",
      originalName: "generated-image-123.png",
      url: "https://example.com/generated.png",
      metadataType: "generated-image",
    } as any);

    await store.dispatch(
      generateAssistantImage({ sessionId: "session-1", prompt: "a robot", size: "1024x1024" }) as any
    );

    expect(generateImageMock).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: "a robot", size: "1024x1024", userToken: "valid-token" })
    );
    expect(uploadEncodedFileMock).toHaveBeenCalledWith(
      expect.objectContaining({
        encodedFile: "data:image/png;base64,ZmFrZS1pbWFnZS1kYXRh",
        sessionId: "session-1",
        metadata: expect.objectContaining({ type: "generated-image" }),
      })
    );

    const messages = selectMessagesForSession(store.getState() as any, "session-1");
    const userMessage = messages.find((message: any) => message.role === "user");
    const assistantMessage = messages.find((message: any) => message.role === "assistant");
    expect(userMessage?.content).toBe("a robot");
    expect(assistantMessage?.attachments).toEqual([
      expect.objectContaining({ metadataType: "generated-image" }),
    ]);
    expect(assistantMessage?.content).toBe("a friendly robot");
    expect(store.getState().chat.isLoadingBySessionId["session-1"]).toBeFalsy();
    expect(store.getState().chat.assistantResponsePhaseBySessionId["session-1"]).toBeUndefined();
  });

  it("surfaces an error message on the assistant placeholder when generation fails", async () => {
    const store = makeStore();
    generateImageMock.mockRejectedValue(new Error("boom"));

    await store.dispatch(
      generateAssistantImage({ sessionId: "session-1", prompt: "a robot" }) as any
    );

    const messages = selectMessagesForSession(store.getState() as any, "session-1");
    const assistantMessage = messages.find((message: any) => message.role === "assistant");
    expect(assistantMessage?.content).toBe("playground:image.errors.generationFailedChat");
    expect(store.getState().toast.toasts).toHaveLength(1);
    expect(store.getState().chat.isLoadingBySessionId["session-1"]).toBeFalsy();
  });

  it("does nothing when the access token is missing", async () => {
    const store = makeStore(null);

    await store.dispatch(
      generateAssistantImage({ sessionId: "session-1", prompt: "a robot" }) as any
    );

    expect(generateImageMock).not.toHaveBeenCalled();
    const messages = selectMessagesForSession(store.getState() as any, "session-1");
    expect(messages).toHaveLength(0);
  });
});
