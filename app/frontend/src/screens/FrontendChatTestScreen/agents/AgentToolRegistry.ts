// AgentToolRegistry.ts

import OpenAI from "openai";

export type AgentToolFunction = (args: any) => Promise<any> | any;

export interface AgentTool {
    name: string;
    description?: string;
    func: AgentToolFunction;
}

export class AgentToolRegistry {
    private tools: Map<string, AgentTool> = new Map();

    registerTool(tool: AgentTool) {
        this.tools.set(tool.name, tool);
    }

    getTool(name: string): AgentTool | undefined {
        return this.tools.get(name);
    }

    getAllTools(): AgentTool[] {
        return Array.from(this.tools.values());
    }

    hasTool(name: string): boolean {
        return this.tools.has(name);
    }

    useTool(name: string, args: unknown): Promise<unknown> | unknown {
        const tool = this.getTool(name);
        if (!tool) {
            throw new Error(`Tool "${name}" not found in registry.`);
        }
        return tool.func(args);
    }

    exportToolSchemas(): OpenAI.Chat.Completions.ChatCompletionTool[] {
        return Array.from(this.tools.values()).map(tool => ({
            type: "function",
            function: {
                name: tool.name,
                description: tool.description,
                // Todo: Define the parameters schema based on the tool's function signature
                parameters: {
                    type: "object",
                    properties: {},
                    required: []
                }
            }
        }));
    }
}
