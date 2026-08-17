import { PublicClientApplication } from "@azure/msal-browser";
import { msalConfig } from "./authConfig";

/**
 * Shared MSAL instance.
 *
 * Kept in its own module (separate from the app entry `index.tsx`) so services and store
 * slices can import it without pulling in the full application bootstrap, which also keeps
 * them importable under the test runner.
 */
export const msalInstance = new PublicClientApplication(msalConfig);
