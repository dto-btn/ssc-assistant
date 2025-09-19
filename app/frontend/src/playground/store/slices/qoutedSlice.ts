import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface QuotedState {
  quotedText: string | null;
}
const initialState: QuotedState = { quotedText: null };

const quotedSlice = createSlice({
  name: "quoted",
  initialState,
  reducers: {
    setQuotedText: (state, action: PayloadAction<string | null>) => {
      state.quotedText = action.payload;
    },
    clearQuotedText: (state) => {
      state.quotedText = null;
    },
  },
});

export const { setQuotedText, clearQuotedText } = quotedSlice.actions;
export default quotedSlice.reducer;