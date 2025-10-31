import MCPClient from "./MCPClient";

// Initialize MCP Clients with ids for lookups when calling tools
const MCP_CLIENTS: Record<number, MCPClient> = {
  0: new MCPClient('http://localhost:8000/mcp'),
};

// Mapping of functions to their MCPClient
let function_lookup: Record<string, number> = {};

// Type definition for MCP Tool Parameter from MCP Server
interface MCPToolParameter {
    type: string;
    description: string;
    required?: boolean;
}

// Type definition for MCP Tool from MCP Server
interface MCPTool {
    name: string;
    description: string;
    parameters: Record<string, MCPToolParameter>;
    serverUrl: string;
}

// Function to fetch & combine all tools from all MCP servers
async function getMCPTools(): Promise<MCPTool[]> {

    // Fetch tools from all clients in parallel
    const results = await Promise.all(Object.values(MCP_CLIENTS).map(async (client) => {
        try {
            const clientTools = await client.listTools();
            return { client, clientTools };
        } catch (err) {
            console.error('Error listing tools from MCPClient:', err);
            return { client, clientTools: null };
        }
    }));

    const MCPtools: MCPTool[] = [];

    for (const { client, clientTools } of results) {
        clientTools?.tools.forEach(tool => {
            // Gather parameters and required fields
            const params: Record<string, MCPToolParameter> = {};
            const required_fields = Array.from(tool.inputSchema?.required?.values() || []);
            const props = Object.entries(tool.inputSchema?.properties || {});

            props.forEach(([key, value]: [string, any]) => {
                params[key] = {
                    type: value.type || 'string',
                    description: value.title || '',
                    required: required_fields.includes(key)
                };
            });

            MCPtools.push({
                name: tool.name,
                description: tool.description ?? '',
                parameters: params,
                serverUrl: client.baseUrl
            });
        });
    }

    return MCPtools;
}

// Type definition for OpenAI Tool Function Parameter
interface OpenAIParameter {
    type: string;
    properties: Record<string, any>;
    required?: string[];
}

// Type definition for OpenAI Tool Function
interface OpenAIFunction {
    name: string;
    description: string;
    parameters: OpenAIParameter;
}

// Type definition for OpenAI Tool
interface OpenAITool {
    type: string;
    function: OpenAIFunction;
}

// Function to map MCP server tools to OpenAI function format
export async function buildOpenAITools(): Promise<OpenAITool[]> {
    let mcpTools = await getMCPTools();
    let openAI_tools: OpenAITool[] = [];

    for (const tool of mcpTools) {
        // Extract required fields
        let required_fields: string[] = [];
        
        Object.entries(tool.parameters).forEach(([key, value]) => {
            if (value.required) {
                required_fields.push(key);
            }
        });

        // Map to OpenAI tool format
        openAI_tools.push({
            type: "function",
            function: {
                name: tool.name.replace(".", "_"),
                description: tool.description,
                parameters: {
                    type: "object",
                    properties: tool.parameters,
                    required: required_fields
                }
            }
        });
    }

    console.log('OpenAI MCP Tools built:', openAI_tools);
    return openAI_tools;
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
    // TODO Implement lookup to fetch MCP Client based on tool name
    const client = MCP_CLIENTS[0]; // Temporary: always use first MCP client

    // Call the tool on the MCP client
    try {
        const result = await client.callTool(toolName, args);
        console.log('Tool call result:', result);
        return result;
    } catch (error) {
        console.error('Error calling tool on MCP:', error);
        throw error;
    }
};
