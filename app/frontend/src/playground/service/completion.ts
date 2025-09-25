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
  // If an explicit Azure OpenAI endpoint is configured in Vite env, call it directly from the browser.
  // Otherwise fall back to the backend proxy (existing behaviour).
  const azureEndpoint = import.meta.env.VITE_AZURE_OPENAI_ENDPOINT as string | undefined;
  if (!azureEndpoint) {
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

  // Direct Azure OpenAI call path
  // Required envs (vite): VITE_AZURE_OPENAI_ENDPOINT (e.g. https://<your-resource>.openai.azure.com),
  // VITE_AZURE_OPENAI_DEPLOYMENT (deployment name) and optional VITE_AZURE_OPENAI_API_VERSION (defaults below)
  const deployment = (import.meta.env.VITE_AZURE_OPENAI_DEPLOYMENT || import.meta.env.VITE_AZURE_OPENAI_MODEL) as string | undefined;
  const apiVersion = (import.meta.env.VITE_AZURE_OPENAI_API_VERSION as string) || "2023-07-01-preview";

  if (!deployment) throw new Error("Missing VITE_AZURE_OPENAI_DEPLOYMENT / VITE_AZURE_OPENAI_MODEL env variable for direct Azure calls");

  const url = `${azureEndpoint.replace(/\/+$/, "")}/openai/deployments/${deployment}/chat/completions?api-version=${apiVersion}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  // Prefer an explicit api key env var for browser usage (VITE_ prefix required by Vite)
  const apiKey = import.meta.env.VITE_AZURE_OPENAI_API_KEY as string | undefined;
  if (apiKey && apiKey.trim().length > 0) {
    headers["api-key"] = apiKey.trim();
  } else if (userToken && userToken.trim().length > 0) {
    // Support using a bearer token (e.g., acquired via MSAL) instead of api-key
    headers["Authorization"] = `Bearer ${userToken.trim()}`;
  } else {
    console.warn("No Azure OpenAI API key or bearer token provided. The request may be rejected by Azure.");
  }

  type AzureChatBody = {
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
    stream?: boolean;
    model?: string;
    max_tokens?: number;
  };

  const body: AzureChatBody = {
    messages,
    stream: true,
  };

  const resp = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Azure OpenAI error ${resp.status}: ${text}`);
  }

  let full = "";
  await streamDeltasFromResponse(resp, (delta) => {
    full += delta;
    console.log("[azure direct chunk]", delta);
  });

  return full;
}

export function useCompletion() {
  const createAzure = useCallback(async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, userToken?: string) => {
    return createAzureCompletion(messages, userToken);
  }, []);

  return { createAzure };
}