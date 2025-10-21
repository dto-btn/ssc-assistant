import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';


export default class MCPClient {
    private readonly url: string;
    private client: Client | undefined = undefined;

    constructor(url: string = 'http://localhost:8000/mcp') {
        this.url = url;
        this.connect();
    }

    private async connect() {
        const baseUrl = new URL(this.url);
        try {
            this.client = new Client({
                name: 'streamable-http-client',
                version: '1.0.0'
            });
            const transport = new StreamableHTTPClientTransport(new URL(baseUrl));
            await this.client.connect(transport);
            console.log('Connected using Streamable HTTP transport');
        } catch (error) {
            // If that fails with a 4xx error, try the older SSE transport
            console.log('Streamable HTTP connection failed, falling back to SSE transport');
            // this.client = new Client({
            //     name: 'sse-client',
            //     version: '1.0.0'
            // });
            // const sseTransport = new SSEClientTransport(baseUrl);
            // await this.client.connect(sseTransport);
            // console.log('Connected using SSE transport');
        }
    }

    // List prompts
    public async listPrompts() {
        return await this.client?.listPrompts();
    }

    // Get a prompt
    public async getPrompt(name: string, args: Record<string, any>) {
        return await this.client?.getPrompt({ name, arguments: args });
    }

    // List resources
    public async listResources() {
        return await this.client?.listResources();
    }

    // Read a resource
    public async readResource(uri: string) {
        return await this.client?.readResource({ uri });
    }

    // List tools
    public async listTools() {
        return await this.client?.listTools();
    }

    // Call a tool
    public async callTool(name: string, args: Record<string, any>) {
        return await this.client?.callTool({ name, arguments: args });
    }
}
