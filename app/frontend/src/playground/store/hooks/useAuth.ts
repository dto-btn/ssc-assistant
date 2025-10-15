/**
 * Authentication Hook for Playground
 *
 * Provides authentication functionality for the playground using MSAL
 * and integrating with Redux for token management.
 */

import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useMsal } from '@azure/msal-react';
import { setAccessToken, clearAccessToken, setTokenRefreshing } from '../slices/authSlice';
import { isTokenExpired } from '../../../util/token';
import type { RootState } from '../index';

// You'll need to import this from your app's auth configuration
interface ApiUseConfig {
  scopes: string[];
  // Add other properties as needed
}

export function useAuth(apiUse: ApiUseConfig) {
  const dispatch = useDispatch();
  const { instance } = useMsal();
  const auth = useSelector((state: RootState) => state.auth);

  // Get token on initial load
  useEffect(() => {
    const getInitialToken = async () => {
      try {
        const account = instance.getActiveAccount();
        if (!account) {
          console.warn('useAuth: No active account found, user may need to login');
          dispatch(clearAccessToken());
          return;
        }

        dispatch(setTokenRefreshing(true));
        
        const response = await instance.acquireTokenSilent({
          ...apiUse,
          account: account,
        });

        dispatch(setAccessToken({
          token: response.accessToken,
          expiresOn: response.expiresOn?.getTime(),
        }));
      } catch (error) {
        console.error('useAuth: Failed to get initial token:', error);
        dispatch(clearAccessToken());
      } finally {
        dispatch(setTokenRefreshing(false));
      }
    };

    // Add a small delay to ensure MSAL is fully initialized
    const timer = setTimeout(getInitialToken, 500);
    return () => clearTimeout(timer);
  }, [instance, apiUse, dispatch]);

  // Function to get a valid token
  const getValidToken = useCallback(async (): Promise<string> => {
    try {
      const account = instance.getActiveAccount();
      if (!account) {
        throw new Error('No active account found');
      }

      // Check if current token is still valid
      if (auth.accessToken && !isTokenExpired(auth.accessToken)) {
        return auth.accessToken;
      }

      dispatch(setTokenRefreshing(true));

      const response = await instance.acquireTokenSilent({
        ...apiUse,
        account: account,
        forceRefresh: true,
      });

      // Store token in Redux
      dispatch(setAccessToken({
        token: response.accessToken,
        expiresOn: response.expiresOn?.getTime(),
      }));

      return response.accessToken;
    } catch (error) {
      console.error('Failed to get token:', error);
      dispatch(clearAccessToken());
      throw error;
    } finally {
      dispatch(setTokenRefreshing(false));
    }
  }, [dispatch, instance, auth.accessToken, apiUse]);

  // Function to manually refresh token
  const refreshToken = useCallback(async (): Promise<void> => {
    await getValidToken();
  }, [getValidToken]);

  // Function to clear token
  const clearToken = useCallback(() => {
    dispatch(clearAccessToken());
  }, [dispatch]);

  return {
    // State
    isAuthenticated: auth.isAuthenticated,
    isTokenRefreshing: auth.isTokenRefreshing,
    accessToken: auth.accessToken,
    
    // Actions
    getValidToken,
    refreshToken,
    clearToken,
  };
}