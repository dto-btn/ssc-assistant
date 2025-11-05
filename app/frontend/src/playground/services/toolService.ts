import { ChatCompletionFunctionTool } from "openai/resources/index.mjs";
import MCPClient from "./MCPClient";

// Initialize MCP Clients with ids for lookups when calling tools
const MCP_CLIENTS: MCPClient[] = [
  new MCPClient('http://localhost:8000/mcp'),
];


// Function to fetch & combine all tools from all MCP servers
export async function getMCPTools(): Promise<ChatCompletionFunctionTool[]> {

    let MCPtools: ChatCompletionFunctionTool[] = [];

    // Fetch tools from all clients in parallel
    await Promise.all(MCP_CLIENTS.map(async (client, index) => {
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
                        name: tool.name + "-" + index, // Append index to retrieve correct MCP client later
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

export const callToolOnMCP = async (toolName: string, args: Record<string, any>): Promise<any> => {

    // Find the MCP client for the given tool
    let clientIndex: number = 0;

    try {
        clientIndex = parseInt(toolName.charAt(toolName.length - 1), 10);
    } catch (error) {
        console.error('Error parsing client index from tool name:', error);
    }

    const client = MCP_CLIENTS[clientIndex]; // Use the mapped MCP client

    const function_name = toolName.slice(0, -2); // Remove the "-X" suffix to get the original function name

    // Call the tool on the MCP client
    try {
        const result = await client.callTool(function_name, args);
        return result;
    } catch (error) {
        console.error('Error calling tool on MCP:', error);
        throw error;
    }
};
