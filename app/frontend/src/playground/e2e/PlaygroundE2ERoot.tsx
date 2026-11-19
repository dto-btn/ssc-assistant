import React from "react";
import { useAppDispatch } from "../store/hooks";
import { setAccessToken } from "../store/slices/authSlice";
import { PlaygroundShell } from "../components/PlaygroundRoot";
import { Route, Routes } from "react-router";
import { SuggestCallbackRoute } from "../../routes/SuggestCallbackRoute";

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

  return (
    <Routes>
      <Route path="/suggest-callback" element={<SuggestCallbackRoute />} />
      <Route path="*" element={<PlaygroundShell />} />
    </Routes>
  );
};

export default PlaygroundE2ERoot;