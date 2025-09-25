import { useCallback } from "react";

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

export async function createAzureCompletion(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, userToken?: string) {
  const baseURL = import.meta.env.VITE_API_BACKEND ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` : "http://localhost:5001/proxy/azure";
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (userToken && userToken.trim().length > 0) headers["Authorization"] = `Bearer ${userToken.trim()}`;

  const resp = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers,
    body: JSON.stringify({ model: "gpt-4o", messages, stream: true }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Upstream error ${resp.status}: ${text}`);
  }

  let full = "";
  await streamDeltasFromResponse(resp, (delta) => {
    full += delta;
    console.log("[azure chunk]", delta);
  });

  return full;
}

export function useCompletion() {
  const createAzure = useCallback(async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, userToken?: string) => {
    return createAzureCompletion(messages, userToken);
  }, []);

  return { createAzure };
}