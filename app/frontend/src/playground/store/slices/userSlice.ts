/**
 * User slice
 *
 * Stores user information
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { GraphData } from "../../../stores/UserContext";

interface UserInformation {
    graphData: GraphData;
    profilePictureURL: string;
}

const initialState: UserInformation = {
    graphData: null,
    profilePictureURL: ""
}

const userSlice = createSlice({
  name: "UserContext",
  initialState,
  reducers: {
    setProfilePictureUrl: (state, action: PayloadAction<string>) => {
      state.profilePictureURL = action.payload;
    },
    setGraphData: (state, action: PayloadAction<GraphData>) => {
      state.graphData = action.payload;
    },
  },
});

export const { setProfilePictureUrl, setGraphData } = userSlice.actions;
export default userSlice.reducer;