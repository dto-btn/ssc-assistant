import { AzureOpenAI } from "openai";
import { useCallback } from "react";

export function useCompletion() {

  const createAzure = useCallback(async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>, userToken: string) => {

    // const response = await instance.acquireTokenSilent({
    //   ...apiUse,
    //   account: instance.getActiveAccount() as AccountInfo,
    //   forceRefresh: true,
    // });
    const baseURL = import.meta.env.VITE_API_BACKEND ? `${import.meta.env.VITE_API_BACKEND}/proxy/azure` : "http://localhost:5001/proxy/azure";
    const client = new AzureOpenAI({
      baseURL,
      apiKey: "#no-thank-you",
      apiVersion: "2024-05-01-preview",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "Authorization": "Bearer " + userToken.trim(),
      }
    });

    // Use chat.completions.create with stream: true for streaming responses
    const stream = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      stream: true,
    });

    let fullText = "";
    for await (const chunk of stream) {
      const delta = chunk.choices?.[0]?.delta?.content ?? "";
      if (delta) {
        fullText += delta;
        console.log(delta);
      }
    }
    return fullText;
  }, []);

  return { createAzure };
}