/**
 * Quoted slice
 *
 * Tracks quoted messages (references to previous chat messages) used when the
 * user quotes or cites prior assistant output. Provides actions to set and
 * clear the quoted message.
 */

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