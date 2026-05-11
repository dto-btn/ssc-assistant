import React from "react";
import { useAppDispatch } from "../store/hooks";
import { setAccessToken } from "../store/slices/authSlice";
import { PlaygroundShell } from "../components/PlaygroundRoot";

const e2eAccessToken = String(import.meta.env.VITE_E2E_ACCESS_TOKEN || "").trim();

if (!e2eAccessToken) {
  throw new Error("VITE_E2E_ACCESS_TOKEN is required for the Playwright playground entrypoint.");
}

const PlaygroundE2ERoot: React.FC = () => {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    dispatch(
      setAccessToken({
        token: e2eAccessToken,
        expiresOn: Date.now() + 60 * 60 * 1000,
      }),
    );
  }, [dispatch]);

  return <PlaygroundShell />;
};

export default PlaygroundE2ERoot;