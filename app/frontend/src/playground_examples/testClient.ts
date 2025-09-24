import { OpenAIClient, AzureKeyCredential } from "@azure/openai";

// Point to your proxy base URL
const client = new OpenAIClient(
  "http://localhost:5001/api/2.0/azure",
  // Placeholder; proxy ignores it
  new AzureKeyCredential("not-used-in-browser"),
);

export async function chatStream(messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  // streamChatCompletions returns an async iterable of events
  const events = await client.streamChatCompletions("gpt-4o", messages);

  let fullText = "";
  for await (const event of events) {
    for (const choice of event.choices) {
      const delta = choice.delta?.content ?? "";
      if (delta) {
        fullText += delta;
        console.log(delta);
      }
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