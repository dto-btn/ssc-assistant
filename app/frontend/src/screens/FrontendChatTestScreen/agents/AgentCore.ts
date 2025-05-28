import OpenAI, { AzureOpenAI } from "openai";

export class AgentCore {
    constructor(private openai: AzureOpenAI) {}

    async processQuery(query: string): Promise<string> {
        // Control variable for the autonomous loop
        let isTurnCompleted = false;
        // Store the final response to return to the user
        let finalResponse: string = '';
        // Track conversation context
        const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
            {
                role: 'system',
                content: `
You are an autonomous reasoning agent that can think through multiple steps before responding. When you receive a query, analyze what information you need and take any actions you need to. Then, continue your reasoning until you have a complete answer. Always conclude your reasoning by calling the 'iAmDone' tool with your comprehensive final answer as the 'finalAnswer' parameter - this is the ONLY way to deliver your response to the user.
                `
            },
            { role: 'user', content: query }
        ];

        // Define available tools for the agent
        const toolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = [
            {
                type: "function",
                function: {
                    name: 'searchInformation',
                    description: 'Search for information about a topic. When the user asks you to search for something, use this function to retrieve relevant information.',
                    parameters: {
                        type: 'object',
                        properties: {
                            topic: { type: 'string', description: 'The topic to search for' }
                        },
                        required: ['topic']
                    }
                }
            },
            {
                type: "function",
                function: {
                    name: 'iAmDone',
                    description: 'Call this function when you have completed your reasoning and have a final answer',
                    parameters: {
                        type: 'object',
                        properties: {
                            finalAnswer: { type: 'string', description: 'Your final answer to the user' }
                        },
                        required: ['finalAnswer']
                    }
                }
            }
        ];

        // Implement the available functions
        const availableFunctions: Record<string, Function> = {
            searchInformation: async (args: { topic: string }) => {
                // Simulate retrieving information
                return `Information about ${args.topic}: This is simulated search result data.`;
            },
            iAmDone: (args: { finalAnswer: string }) => {
                isTurnCompleted = true;
                finalResponse = args.finalAnswer;
                return "Reasoning completed.";
            }
        };

        // Main autonomous reasoning loop
        while (!isTurnCompleted) {
            console.log("Current iteration of the autonomous loop");
            try {
                // Call the OpenAI API
                const response = await this.openai.chat.completions.create({
                    model: "gpt-4o", // Use appropriate model
                    messages: messages,
                    tools: toolSchemas,
                });

                const message = response.choices[0].message;

                // Add the AI's message to the conversation
                messages.push(message);

                // debug console log
                console.log("[DEBUG] AI response:", message);

                // Check if the AI wants to call a tool
                if (message.tool_calls && message.tool_calls.length > 0) {
                    for (const toolCall of message.tool_calls) {
                        if (toolCall.type === 'function') {
                            const functionName = toolCall.function.name;
                            const functionArgs = JSON.parse(toolCall.function.arguments);
                            
                            console.log(`Function called: ${functionName}`);
                            
                            if (availableFunctions[functionName]) {
                                // Execute the function
                                const functionResult = await availableFunctions[functionName](functionArgs);
                                
                                // Add the function result to the conversation
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify(functionResult)
                                });
                            } else {
                                messages.push({
                                    role: 'tool',
                                    tool_call_id: toolCall.id,
                                    content: JSON.stringify({ error: "Function not found" })
                                });
                            }
                        }
                    }
                } else if (message.content) {
                    // If the AI responded with content instead of a tool call,
                    // then do nothing
                    messages.push({
                        role: 'user',
                        content: 'Please call the iAmDone tool with your final answer to complete the interaction.'
                    });
                }
            } catch (error) {
                console.error("Error in autonomous loop:", error);
                isTurnCompleted = true;
                finalResponse = "An error occurred while processing your request.";
            }
        }

        return finalResponse;
    }
}