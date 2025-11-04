import { ChatCompletionFunctionTool } from "openai/resources/index.mjs";
import MCPClient from "./MCPClient";

// Initialize MCP Clients with ids for lookups when calling tools
const MCP_CLIENTS: MCPClient[] = [
  new MCPClient('http://localhost:8000/mcp'),
];

// Mapping of functions to their MCPClient
let function_lookup: Record<string, number> = {};

// Function to fetch & combine all tools from all MCP servers
export async function getMCPTools(): Promise<ChatCompletionFunctionTool[]> {

    let MCPtools: ChatCompletionFunctionTool[] = [];

    // Fetch tools from all clients in parallel
    await Promise.all(MCP_CLIENTS.map(async (client, index) => {
        try {
            const clientTools = await client.listTools();

            // Add server tools to lookup
            clientTools?.tools.forEach(tool => {

                // Add server tools to lookup
                function_lookup[tool.name] = index;

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
                        name: tool.name,
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

export interface ToolCallDef {
    function: {
        name: string;
        arguments: string;
    };
    id: string;
    type: string;
}

export const callToolOnMCP = async (toolName: string, args: Record<string, any>): Promise<any> => {
    //TODO Need to consider situation where 2 MCP servers have the same function name
    //Should be a way to pass server info in tool call response?

    // Find the MCP client for the given tool
    const clientIndex = function_lookup[toolName];
    if (clientIndex === undefined) {
        throw new Error(`No MCP client found for tool: ${toolName}`);
    }

    const client = MCP_CLIENTS[clientIndex]; // Use the mapped MCP client

    // Call the tool on the MCP client
    try {
        const result = await client.callTool(toolName, args);
        return result;
    } catch (error) {
        console.error('Error calling tool on MCP:', error);
        throw error;
    }
};
