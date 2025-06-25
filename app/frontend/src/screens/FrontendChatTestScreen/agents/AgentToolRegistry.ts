// AgentToolRegistry.ts

import OpenAI from "openai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";


export type AgentToolFunction = (args: any) => Promise<any> | any;

export interface RegisterMcpParams {
    name: string;
    url: string;
    type: 'streamable-http';
    version: string;
}

export interface McpClient {
    client: Client;
    transport: Transport;
    isInitialized: boolean; // indicates if the client has connected to the transport
}

export interface AgentTool {
    name: string;
    description?: string;
    func: AgentToolFunction;
}

export class AgentToolRegistry {
    private tools: Map<string, AgentTool> = new Map();
    private mcpClients: Record<string, Record<string, McpClient>> = {}; // name, version -> McpClient

    registerTool(tool: AgentTool) {
        if (this.tools.has(tool.name)) {
            throw new Error(`Tool with name "${tool.name}" is already registered.`);
        }
        this.tools.set(tool.name, tool);
    }

    public async initializeMcpClients(): Promise<void> {
        // Initialize all MCP clients
        for (const [name, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (!mcpClient.isInitialized) {
                    try {
                        await mcpClient.client.connect(mcpClient.transport);
                        mcpClient.isInitialized = true; // Set to true once connected
                    } catch (error) {
                        console.error(`Failed to connect MCP client ${name} version ${version}:`, error);
                    }
                }
            }
        }
    }

    registerMcp(mcpConfig: RegisterMcpParams): void {
        const transport = new StreamableHTTPClientTransport(new URL(mcpConfig.url), {
            sessionId: `abc${mcpConfig.name}`,
            requestInit: {
                keepalive: true
            }
        });
        const client = new Client({
            name: mcpConfig.name,
            version: mcpConfig.version
        });
        // client.connect(transport);
        // set name, version, and mcpclient
        if (!this.mcpClients[mcpConfig.name]) {
            this.mcpClients[mcpConfig.name] = {};
        }
        if (!this.mcpClients[mcpConfig.name][mcpConfig.version]) {
            this.mcpClients[mcpConfig.name][mcpConfig.version] = {
                client,
                transport,
                isInitialized: false // This can be set to true once the client connects to the transport
            };
        } else {
            throw new Error(`MCP client for ${mcpConfig.name} version ${mcpConfig.version} is already registered.`);
        }
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

    /**
     * Checks if a tool is available, including MCP tools
     * @param name The name of the tool to check
     * @returns Promise<boolean> indicating if the tool is available
     */
    async hasToolAsync(name: string): Promise<boolean> {
        // Check local tools first
        if (this.tools.has(name)) {
            return true;
        }
        
        // Check MCP tools
        try {
            const mcpTools = await this.getMcpTools();
            return mcpTools.some(tool => tool.name === name);
        } catch (error) {
            console.error(`Error checking MCP tools for "${name}":`, error);
            return false;
        }
    }

    useTool(name: string, args: unknown): Promise<unknown> | unknown {
        const tool = this.getTool(name);
        if (tool) {
            return tool.func(args);
        }
        
        // If not found in local tools, try MCP tools
        // Note: MCP tools are async, so we always return a Promise
        return this.useMcpTool(name, args as Record<string, any>);
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

    /**
     * Exports tool schemas including both local and MCP tools
     * @returns Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> All available tool schemas
     */
    async exportToolSchemasAsync(): Promise<OpenAI.Chat.Completions.ChatCompletionTool[]> {
        // Get local tool schemas
        const localToolSchemas = this.exportToolSchemas();
        
        // Get MCP tool schemas
        try {
            const mcpTools = await this.getMcpTools();
            const mcpToolSchemas: OpenAI.Chat.Completions.ChatCompletionTool[] = mcpTools.map(tool => ({
                type: "function",
                function: {
                    name: tool.name,
                    description: tool.description || 'MCP tool',
                    parameters: tool.inputSchema || {
                        type: "object",
                        properties: {},
                        required: []
                    }
                }
            }));
            
            return [...localToolSchemas, ...mcpToolSchemas];
        } catch (error) {
            console.error('Error fetching MCP tool schemas:', error);
            return localToolSchemas;
        }
    }

    /**
     * Fetches all available prompts from connected MCP clients
     * @returns An array of prompts from all MCP clients
     */
    async getMcpPrompts(): Promise<any[]> {
        const allPrompts: any[] = [];
        
        for (const [name, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (mcpClient.isInitialized) {
                    try {
                        const response = await mcpClient.client.listPrompts();
                        if (response.prompts) {
                            allPrompts.push(...response.prompts);
                        }
                    } catch (error) {
                        console.error(`Failed to fetch prompts from MCP client ${name} version ${version}:`, error);
                    }
                }
            }
        }
        
        return allPrompts;
    }

    /**
     * Fetches all available resources from connected MCP clients
     * @returns An array of resources from all MCP clients
     */
    async getMcpResources(): Promise<any[]> {
        const allResources: any[] = [];
        
        for (const [name, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (mcpClient.isInitialized) {
                    try {
                        const response = await mcpClient.client.listResources();
                        if (response.resources) {
                            allResources.push(...response.resources);
                        }
                    } catch (error) {
                        console.error(`Failed to fetch resources from MCP client ${name} version ${version}:`, error);
                    }
                }
            }
        }
        
        return allResources;
    }

    /**
     * Fetches a specific prompt by name from MCP clients
     * @param name The name of the prompt to fetch
     * @param promptArguments Optional arguments for the prompt
     * @returns The fetched prompt content or null if not found
     */
    async getMcpPrompt(name: string, promptArguments?: Record<string, any>): Promise<any | null> {
        for (const [clientName, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (mcpClient.isInitialized) {
                    try {
                        const response = await mcpClient.client.getPrompt({
                            name,
                            arguments: promptArguments
                        });
                        if (response) {
                            return response;
                        }
                    } catch (error) {
                        console.error(`Failed to fetch prompt "${name}" from MCP client ${clientName} version ${version}:`, error);
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * Fetches a specific resource by URI from MCP clients
     * @param uri The URI of the resource to fetch
     * @returns The fetched resource content or null if not found
     */
    async getMcpResource(uri: string): Promise<any | null> {
        for (const [clientName, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (mcpClient.isInitialized) {
                    try {
                        const response = await mcpClient.client.readResource({
                            uri
                        });
                        if (response) {
                            return response;
                        }
                    } catch (error) {
                        console.error(`Failed to fetch resource "${uri}" from MCP client ${clientName} version ${version}:`, error);
                    }
                }
            }
        }
        
        return null;
    }

    /**
     * Fetches all available tools from connected MCP clients
     * @returns An array of tools from all MCP clients
     */
    async getMcpTools(): Promise<any[]> {
        const allTools: any[] = [];
        
        for (const [name, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (mcpClient.isInitialized) {
                    try {
                        const response = await mcpClient.client.listTools();
                        if (response.tools) {
                            allTools.push(...response.tools);
                        }
                    } catch (error) {
                        console.error(`Failed to fetch tools from MCP client ${name} version ${version}:`, error);
                    }
                }
            }
        }
        
        return allTools;
    }

    /**
     * Calls an MCP tool by name with the provided arguments
     * @param name The name of the MCP tool to call
     * @param toolArguments The arguments to pass to the MCP tool
     * @returns The result from the MCP tool call
     */
    async useMcpTool(name: string, toolArguments: Record<string, any>): Promise<any> {
        for (const [clientName, versions] of Object.entries(this.mcpClients)) {
            for (const [version, mcpClient] of Object.entries(versions)) {
                if (mcpClient.isInitialized) {
                    try {
                        // First check if this client has the tool
                        const toolsResponse = await mcpClient.client.listTools();
                        const hasTool = toolsResponse.tools?.some(tool => tool.name === name);
                        
                        if (hasTool) {
                            const response = await mcpClient.client.callTool({
                                name,
                                arguments: toolArguments
                            });
                            return response;
                        }
                    } catch (error) {
                        console.error(`Failed to call MCP tool "${name}" from client ${clientName} version ${version}:`, error);
                    }
                }
            }
        }
        
        throw new Error(`MCP tool "${name}" not found in any connected MCP clients.`);
    }
}
