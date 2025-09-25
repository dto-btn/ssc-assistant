/**
 * Auth slice for playground
 *
 * Manages authentication state including access tokens, token expiration,
 * and MSAL integration for the playground components.
 */

import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  accessToken: string | null;
  tokenExpiration: number | null;
  isAuthenticated: boolean;
  isTokenRefreshing: boolean;
}

const initialState: AuthState = {
  accessToken: null,
  tokenExpiration: null,
  isAuthenticated: false,
  isTokenRefreshing: false,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setAccessToken: (state, action: PayloadAction<{ token: string; expiresOn?: number }>) => {
      state.accessToken = action.payload.token;
      state.tokenExpiration = action.payload.expiresOn || null;
      state.isAuthenticated = true;
      state.isTokenRefreshing = false;
    },
    clearAccessToken: (state) => {
      state.accessToken = null;
      state.tokenExpiration = null;
      state.isAuthenticated = false;
      state.isTokenRefreshing = false;
    },
    setTokenRefreshing: (state, action: PayloadAction<boolean>) => {
      state.isTokenRefreshing = action.payload;
    },
  },
});

export const { setAccessToken, clearAccessToken, setTokenRefreshing } = authSlice.actions;
export default authSlice.reducer;