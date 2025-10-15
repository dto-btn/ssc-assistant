/**
 * Playground Integration Guide for Token Management
 *
 * This shows you how to integrate the token management with your existing
 * MSAL setup from the main app.
 */

import React from "react";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useMsal } from "@azure/msal-react";
import { setAccessToken } from "./store/slices/authSlice";

// Example of how to integrate with your existing auth setup
export function PlaygroundAuthProvider({
  children,
  apiUse,
}: {
  children: React.ReactNode;
  apiUse: any; // Your apiUse configuration
}) {
  const dispatch = useDispatch();
  const { instance } = useMsal();

  // Function to get token using your existing logic
  const getAndStoreToken = async () => {
    try {
      // Use your existing token logic from useApiRequestService
      let token = null; // Get from wherever you currently store it

      if (!token || isTokenExpired(token)) {
        const response = await instance.acquireTokenSilent({
          ...apiUse,
          account: instance.getActiveAccount(),
          forceRefresh: true,
        });

        token = response.accessToken;
      }

      // Store in Redux for playground use
      dispatch(
        setAccessToken({
          token,
          expiresOn: Date.now() + 60 * 60 * 1000, // 1 hour from now
        })
      );
    } catch (error) {
      console.error("Failed to get token for playground:", error);
    }
  };

  // Initialize token when component mounts
  useEffect(() => {
    getAndStoreToken();
  }, []);

  return <>{children}</>;
}

// Token validation function (copy from your existing util/token.ts)
function isTokenExpired(token: string): boolean {
  if (!token) return true;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    const currentTime = Math.floor(Date.now() / 1000);
    return payload.exp < currentTime;
  } catch (error) {
    console.error("Error parsing token:", error);
    return true;
  }
}
