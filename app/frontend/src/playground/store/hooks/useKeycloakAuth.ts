import { useCallback, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { setAccessToken, clearAccessToken, setTokenRefreshing } from "../slices/authSlice";
import type { RootState } from "../index";
import { getKeycloak } from "../../../auth/keycloak";
import { isTokenExpired } from "../../../util/token";

export function useKeycloakAuth() {
  const dispatch = useDispatch();
  const auth = useSelector((state: RootState) => state.auth);

  useEffect(() => {
    const keycloak = getKeycloak();
    if (!keycloak.authenticated || !keycloak.token) {
      dispatch(clearAccessToken());
      return;
    }

    dispatch(setAccessToken({
      token: keycloak.token,
      expiresOn: keycloak.tokenParsed?.exp ? keycloak.tokenParsed.exp * 1000 : undefined,
    }));

    keycloak.onTokenExpired = async () => {
      try {
        dispatch(setTokenRefreshing(true));
        const refreshed = await keycloak.updateToken(30);
        if (refreshed && keycloak.token) {
          dispatch(setAccessToken({
            token: keycloak.token,
            expiresOn: keycloak.tokenParsed?.exp ? keycloak.tokenParsed.exp * 1000 : undefined,
          }));
        }
      } catch (error) {
        console.error("Keycloak token refresh failed", error);
        dispatch(clearAccessToken());
      } finally {
        dispatch(setTokenRefreshing(false));
      }
    };
  }, [dispatch]);

  const getValidToken = useCallback(async (): Promise<string> => {
    const keycloak = getKeycloak();
    if (!keycloak.authenticated) {
      dispatch(clearAccessToken());
      throw new Error("Not authenticated");
    }

    if (auth.accessToken && !isTokenExpired(auth.accessToken)) {
      return auth.accessToken;
    }

    dispatch(setTokenRefreshing(true));
    try {
      await keycloak.updateToken(30);
      if (!keycloak.token) {
        dispatch(clearAccessToken());
        throw new Error("No access token available");
      }

      dispatch(setAccessToken({
        token: keycloak.token,
        expiresOn: keycloak.tokenParsed?.exp ? keycloak.tokenParsed.exp * 1000 : undefined,
      }));

      return keycloak.token;
    } finally {
      dispatch(setTokenRefreshing(false));
    }
  }, [auth.accessToken, dispatch]);

  const refreshToken = useCallback(async (): Promise<void> => {
    await getValidToken();
  }, [getValidToken]);

  const clearToken = useCallback(() => {
    dispatch(clearAccessToken());
  }, [dispatch]);

  return {
    isAuthenticated: auth.isAuthenticated,
    isTokenRefreshing: auth.isTokenRefreshing,
    accessToken: auth.accessToken,
    getValidToken,
    refreshToken,
    clearToken,
  };
}
