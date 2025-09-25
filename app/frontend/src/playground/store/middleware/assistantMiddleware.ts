import { Middleware } from "@reduxjs/toolkit";
import {
  addMessage,
  startAssistantMessage,
  appendToMessage,
  updateMessageContent,
  abortAllStreams,
  abortSessionStreams,
  incrementSessionLoading,
  decrementSessionLoading,
  resetAllSessionLoading,
} from "../slices/chatSlice";
import type { PayloadAction } from "@reduxjs/toolkit";
import { RootState } from "..";
import { getValidAccessToken } from "../../service/authHelpers";

// Note: do NOT import the server-side 'openai' package in browser code.
// Instead call the app proxy via fetch and parse the newline-delimited JSON stream.

async function streamDeltasFromResponse(response: Response, onDelta: (d: string) => void) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    let done = false;
    while (!done) {
      const res = await reader.read();
      done = !!res.done;
      if (res.value) buffer += decoder.decode(res.value, { stream: true });

      const parts = buffer.split(/\n\n/);
      buffer = parts.pop() || "";

      for (const part of parts) {
        const line = part.trim();
        if (!line) continue;
        for (const l of line.split(/\n/)) {
          const trimmed = l.trim();
          if (trimmed === "data: [DONE]") return;
          if (trimmed.startsWith("data:")) {
            const payload = trimmed.replace(/^data:\s*/, "");
            try {
              const obj = JSON.parse(payload);
              const delta = obj?.choices?.[0]?.delta?.content ?? "";
              if (delta) onDelta(delta);
            } catch (err) {
              // ignore parse errors
            }
          }
        }
      }
    }

    if (buffer) {
      for (const l of buffer.split(/\n/)) {
        const trimmed = l.trim();
        if (trimmed.startsWith("data:")) {
          const payload = trimmed.replace(/^data:\s*/, "");
          if (payload === "[DONE]") return;
          try {
            const obj = JSON.parse(payload);
            const delta = obj?.choices?.[0]?.delta?.content ?? "";
            if (delta) onDelta(delta);
          } catch (err) {
            // ignore
          }
        }
      }
    }
  } finally {
    try {
      await reader.cancel();
    } catch (err) {
      console.debug("reader cancel failed", err);
    }
  }
}

// Clean streaming middleware implementation
const assistantMiddleware: Middleware<Record<string, unknown>, RootState> = (store) => {
  // controllers by assistantId (unique per assistant message)
  const controllers = new Map<string, AbortController>();
  // Map sessionId -> Set of assistantIds for that session
  const sessionAssistantIds = new Map<string, Set<string>>();

  return (next) => (action) => {
    const result = next(action);

    // Full abort: abort everything and reset loading counts
    if (((action as unknown) as { type?: string }).type === abortAllStreams.type) {
      controllers.forEach((c) => c.abort());
      controllers.clear();
      sessionAssistantIds.clear();
      store.dispatch(resetAllSessionLoading());
      return result;
    }

    // Abort for a single session
    if (((action as unknown) as { type?: string }).type === abortSessionStreams.type) {
      const sessionId = (action as unknown as PayloadAction<string>).payload;
      const set = sessionAssistantIds.get(sessionId);
      if (set) {
        for (const assistantId of Array.from(set)) {
          const c = controllers.get(assistantId);
          if (c) {
            c.abort();
            controllers.delete(assistantId);
          }
        }
        sessionAssistantIds.delete(sessionId);
        // reset loading count for the session
        store.dispatch(resetAllSessionLoading());
      }
      return result;
    }

    if (addMessage.match(action) && action.payload.role === "user") {
      (async () => {
        const { sessionId } = action.payload;

        const assistantId = (Math.random() + 1).toString(36).substring(2);
        // mark loading for this session
        store.dispatch(incrementSessionLoading(sessionId));
        store.dispatch(startAssistantMessage({ sessionId, id: assistantId }));

        // track assistant id per session
        if (!sessionAssistantIds.has(sessionId)) sessionAssistantIds.set(sessionId, new Set());
        sessionAssistantIds.get(sessionId)!.add(assistantId);

        const state = store.getState();
        const sessionMessages = state.chat.messages
          .filter((m) => m.sessionId === sessionId)
          .map((m) => ({ role: m.role as unknown as string, content: m.content }));

        let accessToken = "";
        try {
          accessToken = await getValidAccessToken();
        } catch (err) {
          // User is being redirected to login or token acquisition failed
          store.dispatch(decrementSessionLoading(sessionId));
          sessionAssistantIds.get(sessionId)?.delete(assistantId);
          return;
        }

        const baseURL = import.meta.env.VITE_API_BACKEND ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` : "http://localhost:5001/proxy/azure";
        const controller = new AbortController();
        controllers.set(assistantId, controller);

        try {
          const headers: Record<string, string> = {
            "Content-Type": "application/json",
          };
          if (accessToken && accessToken.trim().length > 0) {
            headers.Authorization = `Bearer ${accessToken.trim()}`;
          }

          const resp = await fetch(`${baseURL}/chat/completions`, {
            method: "POST",
            headers,
            body: JSON.stringify({ model: "gpt-4o", messages: sessionMessages, stream: true }),
            signal: controller.signal,
          });

          if (!resp.ok) {
            const text = await resp.text();
            console.error("Proxy upstream non-OK", resp.status, text);
            throw new Error(`Upstream error ${resp.status}: ${text}`);
          }

          const contentType = resp.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            console.warn("Received non-streaming JSON response from proxy; parsing full completion");
            try {
              const j = await resp.json();
              const text = j?.choices?.[0]?.message?.content ?? j?.choices?.[0]?.text ?? "";
              if (text) {
                store.dispatch(appendToMessage({ id: assistantId, delta: text }));
                store.dispatch(updateMessageContent({ id: assistantId, content: text }));
              } else {
                console.warn("JSON response did not contain expected completion text", j);
              }
            } catch (err) {
              console.error("Failed to parse JSON upstream response", err);
            }
          } else {
            let full = "";
            let receivedAny = false;
            await streamDeltasFromResponse(resp, (delta) => {
              receivedAny = true;
              full += delta;
              store.dispatch(appendToMessage({ id: assistantId, delta }));
            });

            if (!receivedAny) {
              console.warn("Stream completed without any deltas");
            }

            store.dispatch(updateMessageContent({ id: assistantId, content: full }));
          }
        } catch (err) {
          const e = err as { name?: string } | undefined;
          if (e?.name === "AbortError") {
            console.debug("assistant stream aborted", assistantId);
          } else {
            console.error("assistant stream error", err);
          }
        } finally {
          controllers.delete(assistantId);
          sessionAssistantIds.get(sessionId)?.delete(assistantId);
          // decrement loading count for session
          store.dispatch(decrementSessionLoading(sessionId));
        }
      })();
    }

    return result;
  };
};

export default assistantMiddleware;