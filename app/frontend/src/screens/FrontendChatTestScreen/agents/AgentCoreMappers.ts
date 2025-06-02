import OpenAI from "openai";
import { AgentCoreMemory } from "./AgentCoreMemory";
import { AgentToolCall } from "./AgentCoreMemory.types";

export const mapMemoryExportToOpenAIMessage = (memory: AgentCoreMemory): OpenAI.Chat.Completions.ChatCompletionMessageParam[] => {
    const turns = memory.export();

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [];

    for (const turn of turns) {
        if (turn.type === 'turn:user') {
            for (const action of turn.actions) {
                switch (action.type) {
                    case 'action:user-message':
                        messages.push({
                            role: 'user',
                            content: action.content
                        });
                        break;
                    default:
                        throw new Error(`Unknown user action type: ${action.type}`);
                }
            }
        } else if (turn.type === 'turn:agent') {
            let currentToolCalls: AgentToolCall[] | undefined = undefined;

            for (const action of turn.actions) {
                // If we have tool calls and the next action is not a tool call, we need to flush them
                if (currentToolCalls !== undefined && action.type !== 'action:agent-tool-call') {
                    messages.push({
                        role: 'assistant',
                        tool_calls: currentToolCalls.map(toolCall => ({
                            id: toolCall.toolCallId,
                            type: 'function',
                            function: {
                                name: toolCall.toolName,
                                arguments: toolCall.toolArguments
                            }
                        }))
                    });
                    currentToolCalls = undefined; // Reset tool calls after flushing   
                }


                switch (action.type) {
                    case 'action:agent-message':
                        messages.push({
                            role: 'assistant',
                            content: action.content
                        });
                        break;
                    case 'action:agent-thought':
                        messages.push({
                            role: 'assistant',
                            content: `Thought: ${action.content}`
                        });
                        break;
                    case 'action:agent-observation':
                        messages.push({
                            role: 'assistant',
                            content: `Observation: ${action.content}`
                        });
                        break;
                    case 'action:agent-tool-call':
                        // Tool calls in OpenAI appear inside assistant messages as an array.
                        // However, we add separate messages for each tool call in our memory.
                        // So we need to collect them until we hit a non-tool call action.
                        if (!currentToolCalls) {
                            currentToolCalls = [];
                        }
                        currentToolCalls.push(action);
                        break;
                    case 'action:agent-tool-call-response':
                        messages.push({
                            role: 'tool',
                            tool_call_id: action.toolCallId,
                            content: action.toolResponse
                        });
                        break;
                    case 'action:agent-error':
                        messages.push({
                            role: 'assistant',
                            content: `Error: ${action.content}`
                        });
                        break;
                    default:
                        throw new Error(`Unknown agent action type: ${action.type}`);
                }
            }
        } else {
            throw new Error(`Unknown turn type`, turn);
        }
    }

    return messages;
};
