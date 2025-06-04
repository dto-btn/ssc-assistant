// To run:
// pnpm tsx src/screens/FrontendChatTestScreen/agents/testcases/generate.ts

import { provideProxyOpenAiClient } from "../../../../providers/provideProxyOpenAiClient";
import fs from 'fs';
import OpenAI from "openai";
import path from 'path';

const openaiClient = provideProxyOpenAiClient({
    apiRootDomain: "http://localhost:5001",
})

let receivedChunks = []

const generate = async (filename: string, body: OpenAI.Chat.ChatCompletionCreateParamsStreaming) => {
    try {
        const response = await openaiClient.chat.completions.create(body);
        
        for await (const chunk of response) {
            receivedChunks.push(chunk);
        }

        console.log("Received chunks:");
        console.log(JSON.stringify(receivedChunks, null, 2));

        const targetFile = path.join(import.meta.dirname, filename);
        fs.writeFileSync(targetFile, JSON.stringify(receivedChunks, null, 2));
    } catch (error) {
        console.error("Error:", error);
    }
}

const main = async () => {
    await generate('simple_chat.json', {
        model: "gpt-4o",
        messages: [
            {
                role: "user",
                content: "Hello, how are you?"
            }
        ],
        max_tokens: 100,
        stream: true
    });

    await generate('streaming_tool_calls.json', {
        model: "gpt-4o",
        messages: [
            {
                role: "user",
                content: "You have 4 tools: adder, multiplier, divider, and subtractor. Use them to calculate 2 + 3, then multiply the result by 4, divide it by 2, and finally subtract 1. Provide the final result."
            }
        ],
        max_tokens: 100,
        stream: true,
        tools: [
            {
                type: "function",
                function: {
                    name: "adder",
                    description: "Adds two numbers",
                    parameters: {
                        type: "object",
                        properties: {
                            a: { type: "number", description: "First number" },
                            b: { type: "number", description: "Second number" }
                        },
                        required: ["a", "b"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "multiplier",
                    description: "Multiplies two numbers",
                    parameters: {
                        type: "object",
                        properties: {
                            a: { type: "number", description: "First number" },
                            b: { type: "number", description: "Second number" }
                        },
                        required: ["a", "b"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "divider",
                    description: "Divides two numbers",
                    parameters: {
                        type: "object",
                        properties: {
                            a: { type: "number", description: "Dividend" },
                            b: { type: "number", description: "Divisor" }
                        },
                        required: ["a", "b"]
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: "subtractor",
                    description: "Subtracts two numbers",
                    parameters: {
                        type: "object",
                        properties: {
                            a: { type: "number", description: "Minuend" },
                            b: { type: "number", description: "Subtrahend" }
                        },
                        required: ["a", "b"]
                    }
                }
            }
        ],
    })

    console.log("Generation complete. Check receivedChunks.simple.json for results.");
}

main().catch(console.error);