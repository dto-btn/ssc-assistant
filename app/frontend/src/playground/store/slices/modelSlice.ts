import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface ModelState {
  selectedModel: string;
  availableModels: string[];
}

const initialState: ModelState = {
  selectedModel: "gpt-4",
  availableModels: ["gpt-3.5", "gpt-4", "gpt-4-turbo"],
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
  },
});

export const { setSelectedModel, setAvailableModels } = modelSlice.actions;
export default modelSlice.reducer;