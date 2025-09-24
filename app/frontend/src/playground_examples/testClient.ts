import { AzureOpenAI } from "openai";

// Point to your proxy base URL - use frontend server proxy
const client = new AzureOpenAI(
    {   //process.env.VITE_API_BACKEND
        baseURL: "http://localhost:5001/proxy/azure",
        apiKey: "#no-thank-you",
        apiVersion: "2024-05-01-preview",
        dangerouslyAllowBrowser: true,
    }
);

export async function chatStream(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
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
}

const exampleMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: "You are a helpful AI assistant." },
    { role: "user", content: "Tell me about Shared Services Canada." }
];

chatStream(exampleMessages).then((response) => {
    console.log("Final response:", response);
});