/**
 * Model slice
 *
 * Holds configuration and state for the assistant model used in the
 * playground (e.g., model id, temperature, streaming flags). Exposes actions
 * to update model parameters.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type GenerationMode = "chat" | "image";

export interface ModelState {
  selectedModel: string;
  availableModels: string[];
  generationMode: GenerationMode;
  imageSize: string;
}

const resolveDefaultImageModel = (): string => {
  const configured = String(import.meta.env.VITE_LITELLM_IMAGE_MODEL || "").trim();
  return configured.length > 0 ? configured : "flux-2-flex";
};

export { resolveDefaultImageModel };

const initialState: ModelState = {
  selectedModel: "gpt-4",
  availableModels: ["gpt-3.5", "gpt-4", "gpt-4-turbo"],
  generationMode: "chat",
  imageSize: "1024x1024",
};

const modelSlice = createSlice({
  name: "models",
  initialState,
  reducers: {
    setSelectedModel: (state, action: PayloadAction<string>) => {
      state.selectedModel = action.payload;
    },
    setAvailableModels: (state, action: PayloadAction<string[]>) => {
      state.availableModels = action.payload;
    },
    setGenerationMode: (state, action: PayloadAction<GenerationMode>) => {
      state.generationMode = action.payload;
    },
    setImageSize: (state, action: PayloadAction<string>) => {
      state.imageSize = action.payload;
    },
  },
});

export const { setSelectedModel, setAvailableModels, setGenerationMode, setImageSize } = modelSlice.actions;
export default modelSlice.reducer;