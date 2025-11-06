import { ChatCompletionFunctionTool } from "openai/resources/index.mjs";
import MCPClient from "./MCPClient";

// Initialize MCP Clients
const MCP_CLIENTS: MCPClient[] = [
  new MCPClient('http://localhost:8000/mcp'),
];

class ToolService {
    private mcpClients: MCPClient[];

    constructor(mcpClients: MCPClient[]) {
        this.mcpClients = mcpClients;
    }

    // Function to fetch & combine all tools from all MCP servers
    async listTools(): Promise<ChatCompletionFunctionTool[]> {
        let MCPtools: ChatCompletionFunctionTool[] = [];

        // Fetch tools from all clients in parallel
        await Promise.all(this.mcpClients.map(async (client, index) => {
            try {
                const clientTools = await client.listTools();

                // Add server tools to lookup
                clientTools?.tools.forEach(tool => {

                    // Map tool parameters
                    const required_fields = Array.from(tool.inputSchema?.required?.values() || []);
                    const props = Object.entries(tool.inputSchema?.properties || {});
                    let params: Record<string, {type: string; description: string}> = {};

                    props.forEach(([key, value]: [string, any]) => {
                        params[key] = {
                            type: value.type || 'string',
                            description: value.title || '',
                        };
                    });

                    // Format tools for LLM
                    MCPtools.push({
                        type: "function",
                        function: {
                            name: tool.name + "--mcp--" + index, // Append index to retrieve correct MCP client later
                            description: tool.description ?? '',
                            parameters: {
                                type: "object",
                                properties: params,
                                required: required_fields,
                                additionalProperties: false,
                            },
                            strict: false,
                        },
                    });
                });

            } catch (err) {
                console.error('Error listing tools from MCPClient:', err);
            }
        }));

        return MCPtools;
    }

    // Function to call a tool on the appropriate MCP server
    async callTool(toolName: string, args: Record<string, any>): Promise<any> {
        // Find the MCP client for the given tool
        let clientIndex: number = this.extractClientIndex(toolName);
        let function_name: string = this.extractToolName(toolName);

        const client = this.mcpClients[clientIndex]; // Use the mapped MCP client

        // Call the tool on the MCP client
        try {
            const result = await client.callTool(function_name, args);
            return result;
        } catch (error) {
            console.error('Error calling tool on MCP:', error);
            throw error;
        }
    }

    extractToolName(toolName: string): string {
        const parts = toolName.split("--mcp--");
        return parts[0]; // Return the original function name without the index
    }

    extractClientIndex(toolName: string): number {
        const parts = toolName.split("--mcp--");
        if (parts.length === 2) {
            const index = parseInt(parts[1], 10);
            if (!isNaN(index)) {
                return index;
            }
        }
        throw new Error(`Malformed tool name "${toolName}": missing or invalid MCP client index`);
    }
}

export const toolService = new ToolService(MCP_CLIENTS);
