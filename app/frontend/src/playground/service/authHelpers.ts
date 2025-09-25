import { msalInstance } from "../../index";
import { apiUse } from "../../authConfig";

/**
 * Ensures the user is authenticated and returns a valid access token.
 * If not authenticated, triggers login and throws (caller should retry after login).
 * @param scopes Array of scopes to request (default: uses configured api scope)
 */
export async function getValidAccessToken(scopes: string[] = apiUse.scopes): Promise<string> {
  const account = msalInstance.getActiveAccount();
  if (!account) {
    // Trigger login and throw to halt flow
    await msalInstance.loginRedirect({ scopes });
    throw new Error("User not authenticated. Redirecting to login.");
  }
  try {
    const resp = await msalInstance.acquireTokenSilent({ scopes, account });
    if (!resp.accessToken) throw new Error("Failed to acquire access token.");
    return resp.accessToken;
  } catch (err) {
    // If silent fails, force login
    await msalInstance.loginRedirect({ scopes });
    throw new Error("Could not acquire access token. Redirecting to login.");
  }
}
