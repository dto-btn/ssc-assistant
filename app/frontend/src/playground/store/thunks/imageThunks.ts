/**
 * Image generation thunk.
 *
 * Separate from `assistantThunks.ts` (chat/MCP orchestration) because text-to-image
 * generation is a single non-streaming call to LiteLLM's `/v1/images/generations`
 * endpoint (Azure-hosted FLUX.2-flex), with no orchestrator routing or citations.
 * The generated image is uploaded through the existing playground blob-storage
 * upload flow so it persists and renders like any other chat attachment.
 */
import {
  addMessage,
  setSessionLoading,
  setAssistantResponsePhase,
  clearAssistantResponsePhase,
  setMessageAttachments,
  updateMessageContent,
} from "../slices/chatSlice";
import { resolveDefaultImageModel } from "../slices/modelSlice";
import { addToast } from "../slices/toastSlice";
import { completionService } from "../../services/completionService";
import { isTokenExpired } from "../../../util/token";
import { AppThunk } from "..";
import i18n from "../../../i18n";
import { uploadEncodedFile } from "../../api/storage";
import { selectMessagesForSession } from "../selectors/chatSelectors";
import { sessionAbortControllers } from "./assistantThunks";

export interface GenerateAssistantImageArgs {
  sessionId: string;
  prompt: string;
  size?: string;
}

/**
 * Generate an image from a text prompt and attach the uploaded result to a new
 * assistant message in the given session.
 */
export const generateAssistantImage = ({
  sessionId,
  prompt,
  size,
}: GenerateAssistantImageArgs): AppThunk<Promise<void>> => async (dispatch, getState) => {
  const trimmedPrompt = prompt.trim();
  if (!trimmedPrompt) {
    return;
  }

  dispatch(setSessionLoading({ sessionId, loading: true }));
  dispatch(setAssistantResponsePhase({ sessionId, phase: "generating-image" }));
  const abortController = new AbortController();
  sessionAbortControllers.set(sessionId, abortController);

  let placeholderAssistantMessageId: string | undefined;
  try {
    const { accessToken } = getState().auth;
    if (!accessToken || isTokenExpired(accessToken)) {
      dispatch(
        addToast({
          message: i18n.t("playground:auth.tokenExpired"),
          isError: true,
        })
      );
      return;
    }

    dispatch(addMessage({ sessionId, role: "user", content: trimmedPrompt }));
    dispatch(addMessage({ sessionId, role: "assistant", content: "" }));

    const assistantMessages = selectMessagesForSession(getState(), sessionId).filter(
      (message) => message.role === "assistant"
    );
    const latestAssistantMessage = assistantMessages[assistantMessages.length - 1];
    if (!latestAssistantMessage) {
      throw new Error("Failed to create assistant message");
    }
    placeholderAssistantMessageId = latestAssistantMessage.id;

    const model = resolveDefaultImageModel();
    const result = await completionService.generateImage({
      prompt: trimmedPrompt,
      model,
      userToken: accessToken,
      size,
      signal: abortController.signal,
    });

    const [firstImage] = result.images;
    if (!firstImage?.b64Json) {
      throw new Error(i18n.t("playground:image.errors.noImageReturned"));
    }

    const dataUrl = `data:image/png;base64,${firstImage.b64Json}`;
    const uploaded = await uploadEncodedFile({
      encodedFile: dataUrl,
      originalName: `generated-image-${Date.now()}.png`,
      accessToken,
      sessionId,
      category: "files",
      mimeType: "image/png",
      metadata: {
        type: "generated-image",
        prompt: trimmedPrompt.slice(0, 500),
      },
    });

    dispatch(
      setMessageAttachments({
        messageId: placeholderAssistantMessageId,
        attachments: [uploaded],
      })
    );
    dispatch(
      updateMessageContent({
        messageId: placeholderAssistantMessageId,
        content: firstImage.revisedPrompt || "",
      })
    );
  } catch (error) {
    if (abortController.signal.aborted) {
      return;
    }

    console.error("Image generation failed", error);
    const assistantErrorMessage = i18n.t("playground:image.errors.generationFailedChat");
    if (placeholderAssistantMessageId) {
      dispatch(
        updateMessageContent({
          messageId: placeholderAssistantMessageId,
          content: assistantErrorMessage,
        })
      );
    } else {
      dispatch(addMessage({ sessionId, role: "assistant", content: assistantErrorMessage }));
    }
    dispatch(
      addToast({
        message: i18n.t("playground:image.errors.generationFailedToast"),
        isError: true,
      })
    );
  } finally {
    dispatch(setSessionLoading({ sessionId, loading: false }));
    dispatch(clearAssistantResponsePhase(sessionId));
    sessionAbortControllers.delete(sessionId);
  }
};
