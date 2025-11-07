import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
// import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';


export default class MCPClient {
    private readonly url: string;
    private client: Client | undefined = undefined;

    private constructor(url: string) {
        this.url = url;
    }

    // Use this static method to create and connect the client  
    public static async create(url: string): Promise<MCPClient> {  
        const client = new MCPClient(url);  
        await client.connect();  
        return client;  
    }

    // Establish connection to MCP server
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

    // Getter for base URL
    public get baseUrl() {
        return this.url;
    }

    // List prompts
    public async listPrompts() {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.listPrompts();
    }

    // Get a prompt
    public async getPrompt(name: string, args: Record<string, any>) {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.getPrompt({ name, arguments: args });
    }

    // List resources
    public async listResources() {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.listResources();
    }

    // Read a resource
    public async readResource(uri: string) {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.readResource({ uri });
    }

    // List tools
    public async listTools() {
        if (!this.client) throw new Error('MCP client not connected');
        return await this.client.listTools();
    }

    // Call a tool
    public async callTool(name: string, args: Record<string, any>) {
        if (!this.client) throw new Error('MCP client not connected');
        if (Object.keys(args).length === 0) {
            return await this.client.callTool({ name });
        } else {
            return await this.client.callTool({ name, arguments: args });
        }
    }
}
