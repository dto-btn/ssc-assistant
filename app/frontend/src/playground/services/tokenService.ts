/**
 * Token Service for Playground
 *
 * Handles token validation, refresh, and management using MSAL.
 * Integrates with Redux store to maintain token state.
 */

import { IPublicClientApplication } from "@azure/msal-browser";
import { isTokenExpired } from "../../util/token";

interface SilentRequestConfig {
  scopes: string[];
  [key: string]: unknown;
}

export class TokenService {
  /**
   * Get a valid access token, refreshing if necessary
   * @param instance MSAL instance
   * @param currentToken Current token from Redux state
   * @param apiUse API configuration object
   * @returns Valid access token
   */
  static async getValidToken(
    instance: IPublicClientApplication,
    currentToken: string | null,
    apiUse: SilentRequestConfig
  ): Promise<{ token: string; expiresOn?: number }> {
    // Check if token is missing or expired
    if (!currentToken || isTokenExpired(currentToken)) {
      try {
        const response = await instance.acquireTokenSilent({
          ...apiUse,
          account: instance.getActiveAccount() ?? undefined,
          forceRefresh: true,
        });

        return {
          token: response.accessToken,
          expiresOn: response.expiresOn?.getTime(),
        };
      } catch (error) {
        console.error('Token refresh failed:', error);
        throw new Error('Failed to acquire access token');
      }
    }

    return { token: currentToken };
  }

  /**
   * Check if current token needs refresh
   * @param token Current access token
   * @returns boolean indicating if refresh is needed
   */
  static needsRefresh(token: string | null): boolean {
    return !token || isTokenExpired(token);
  }
}