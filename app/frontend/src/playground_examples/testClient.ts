import { AccountInfo } from "@azure/msal-browser";
import { AzureOpenAI } from "openai";
import { apiUse } from "../authConfig";
import { useMsal } from "@azure/msal-react";
import { useCallback } from "react";

export function useChatStream() {
  const { instance } = useMsal();

  const chatStream = useCallback(async (messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) => {
    const response = await instance.acquireTokenSilent({
      ...apiUse,
      account: instance.getActiveAccount() as AccountInfo,
      forceRefresh: true,
    });

    const accessToken = response.accessToken;
    // Point to your proxy base URL - use frontend server proxy
    const client = new AzureOpenAI({
      baseURL: "http://localhost:5001/proxy/azure",
      apiKey: "#no-thank-you",
      apiVersion: "2024-05-01-preview",
      dangerouslyAllowBrowser: true,
      defaultHeaders: {
        "Authorization": "Bearer " + accessToken.trim(),
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
  }, [instance]);

  return { chatStream };
}

// Example of how to use this hook in a React component:
// 
// import { useChatStream } from './testClient';
// import { useEffect } from 'react';
// 
// function MyComponent() {
//   const { chatStream } = useChatStream();
// 
//   useEffect(() => {
//     const exampleMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
//       { role: "system", content: "You are a helpful AI assistant." },
//       { role: "user", content: "Tell me about Shared Services Canada." }
//     ];
// 
//     chatStream(exampleMessages).then((response) => {
//       console.log("Final response:", response);
//     });
//   }, [chatStream]);
// 
//   return <div>Chat component</div>;
// }