// import { ChatCompletionFunctionTool } from "openai/resources/index.mjs";
// import MCPClient from "./MCPClient";

// // Environment-based MCP URLs (comma-separated in VITE_MCP_URLS)
// const MCP_URLS = import.meta.env.VITE_MCP_URLS?.split(',') || [];


// // Helper functions to extract tool name and client index
// export const extractToolName = (toolName: string): string => {
//     const parts = toolName.split("--mcp--");
//     return parts[0]; // Return the original function name without the index
// }

// export const extractClientIndex = (toolName: string): number => {
//     const parts = toolName.split("--mcp--");
//     if (parts.length === 2) {
//         const index = parseInt(parts[1], 10);
//         if (!isNaN(index)) {
//             return index;
//         }
//     }
//     throw new Error(`Malformed tool name "${toolName}": missing or invalid MCP client index`);
// };

// /**
//  * Tool Service - Manages MCP clients and tool listings
//  */
// class ToolService {
//     private static instance: ToolService | null = null;
//     private mcpClients: MCPClient[];
//     private cachedTools: ChatCompletionFunctionTool[] | null = null;

//     private constructor(mcpClients: MCPClient[]) {
//         this.mcpClients = mcpClients;

        
//     }

//     public static async getInstance(token: string): Promise<ToolService> {
//         if (!ToolService.instance) {
//             // Await creation of all MCP clients
//             const mcpClients = await Promise.all(
//                 MCP_URLS.map(async (url: string) => await MCPClient.create(url.trim(), token))
//             );
//             ToolService.instance = new ToolService(mcpClients);
//         }
//         return ToolService.instance;
//     }

//     // Get the list of MCP clients (read-only)
//     public getMcpClients(): MCPClient[] {
//         return [...this.mcpClients]; // Return a copy to prevent mutation
//     }

//     // Function to fetch & combine all tools from all MCP servers (cached)
//     public async listTools(): Promise<ChatCompletionFunctionTool[]> {
//         if (this.cachedTools) {
//             console.log('ToolService: Returning cached tools.', this.cachedTools);
//             return this.cachedTools;
//         }

//         let MCPtools: ChatCompletionFunctionTool[] = [];

//         // Fetch tools from all clients in parallel
//         await Promise.all(this.mcpClients.map(async (client, index) => {
//             try {
//                 const clientTools = await client.listTools();

//                 // Add server tools to lookup
//                 clientTools?.tools.forEach(tool => {
//                     // Map tool parameters
//                     const required_fields = Array.from(tool.inputSchema?.required?.values() || []);
//                     const props = Object.entries(tool.inputSchema?.properties || {});
//                     let params: Record<string, {type: string; description: string}> = {};

//                     props.forEach(([key, value]: [string, any]) => {
//                         params[key] = {
//                             type: value.type || 'string',
//                             description: value.title || '',
//                         };
//                     });

//                     // Format tools for LLM
//                     MCPtools.push({
//                         type: "function",
//                         function: {
//                             name: tool.name + "--mcp--" + index, // Append index to retrieve correct MCP client later
//                             description: tool.description ?? '',
//                             parameters: {
//                                 type: "object",
//                                 properties: params,
//                                 required: required_fields,
//                                 additionalProperties: false,
//                             },
//                             strict: false,
//                         },
//                     });
//                 });

//             } catch (err) {
//                 console.error('Error listing tools from MCPClient:', err);
//             }
//         }));

//         console.log(`MCP: Fetched total ${MCPtools.length} tools from ${this.mcpClients.length} MCP servers.`);

//         this.cachedTools = MCPtools;
//         return MCPtools;
//     }

//     // Function to call a tool on the appropriate MCP server
//     public async callTool(toolName: string, args: Record<string, any>): Promise<any> {
//         // Find the MCP client for the given tool
//         let clientIndex: number = extractClientIndex(toolName);
//         let function_name: string = extractToolName(toolName);

//         const client = this.mcpClients[clientIndex]; // Use the mapped MCP client

//         // Call the tool on the MCP client
//         try {
//             const result = await client.callTool(function_name, args);
//             return result;
//         } catch (error) {
//             console.error('Error calling tool on MCP:', error);
//             throw error;
//         }
//     }
// }

// // Export an async function to get the singleton instance
// export const getToolService = async (token: string) => ToolService.getInstance(token);