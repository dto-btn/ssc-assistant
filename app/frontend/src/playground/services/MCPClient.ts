import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

/**
 * MCP Client - Wrapper around Model Context Protocol client
 * Connects to MCP server and provides methods to interact with it
 */
export default class MCPClient {
    private readonly url: string;
    private client: Client | undefined = undefined;

    private constructor(url: string) {
        this.url = url;
    }

    /**
     * Factory that instantiates + connects the MCP client before handing it back to callers.
     */
    public static async create(url: string): Promise<MCPClient> {
        const client = new MCPClient(url);
        await client.connect();
        return client;
    }

    /**
     * Establish the transport connection to the remote MCP server.
     */
    private async connect() {
        const baseUrl = new URL(this.url);
        try {
            this.client = new Client({
                name: 'streamable-http-client',
                version: '1.0.0'
            });

            const transport = new StreamableHTTPClientTransport(baseUrl);

            await this.client.connect(transport);
        } catch (error) {
            console.error('Error connecting to MCP server:', error);
        }
    }

    /**
     * Convenience getter used by the tool service when surfacing debug info.
     */
    public get baseUrl() {
        return this.url;
    }

    /**
     * Enumerate prompts exposed by the target MCP server.
     */
    public async listPrompts() {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.listPrompts();
    }

    /**
     * Fetch a single prompt definition with the supplied arguments so callers can render it.
     */
    public async getPrompt(name: string, args: Record<string, any>) {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.getPrompt({ name, arguments: args });
    }

    /**
     * List the resources exposed by the MCP host.
     */
    public async listResources() {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.listResources();
    }

    /**
     * Read a single MCP resource by URI.
     */
    public async readResource(uri: string) {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.readResource({ uri });
    }

    /**
     * Surface every tool registered with the MCP server.
     */
    public async listTools() {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.listTools();
    }

    /**
     * Invoke a tool with optional arguments, handling tools that accept empty payloads.
     */
    public async callTool(name: string, args: Record<string, any>) {
        if (!this.client) throw new Error('MCP client not connected');
        if (Object.keys(args).length === 0) {
            return await this.client.callTool({ name });
        } else {
            return await this.client.callTool({ name, arguments: args });
        }
    }
}
