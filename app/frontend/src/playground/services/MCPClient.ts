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

                let token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsIng1dCI6InJ0c0ZULWItN0x1WTdEVlllU05LY0lKN1ZuYyIsImtpZCI6InJ0c0ZULWItN0x1WTdEVlllU05LY0lKN1ZuYyJ9.eyJhdWQiOiJhcGk6Ly81ZTk0NWQyMy00OGQ5LTQ5MjktYjFhMS05M2E5Y2E1OGY4YWEiLCJpc3MiOiJodHRwczovL3N0cy53aW5kb3dzLm5ldC9kMDViYzE5NC05NGJmLTRhZDYtYWUyZS0xZGIwZjJlMzhmNWUvIiwiaWF0IjoxNzY0Njg2NTc1LCJuYmYiOjE3NjQ2ODY1NzUsImV4cCI6MTc2NDY5MDc4OSwiYWNyIjoiMSIsImFpbyI6IkFiUUFTLzhhQUFBQUhFd0E2MDhUQXVXYnRVWCtrdUpiT1dVcUFWZit2Mk9KR0piNUowL29XbmtzbE5yRDdIbkhHNkRYRllLSld4WWhoZXlSbklyVUpHZkEvdXpLOStraTlHeE9aRktOVXRQWEVlT0xFTFY4eEVxZ0M2M1p6QU42OVJpaFpOWUpWVnFTL3VlOWJZbHoxUTJNcHc1eWJyY1ZoZGtFKy9uRWVZeHRIUDRqaEpVZnpwNGU0Ty92TnIrakdUUHZJUUs0T3MzMnpWV1N5a2FjTGh0VlArSFo5eUw1S29kY0FmYTgzWGZ0NXFqRGgzWWllVlE9IiwiYW1yIjpbInB3ZCIsImZpZG8iLCJyc2EiLCJtZmEiXSwiYXBwaWQiOiI1ZTk0NWQyMy00OGQ5LTQ5MjktYjFhMS05M2E5Y2E1OGY4YWEiLCJhcHBpZGFjciI6IjAiLCJkZXZpY2VpZCI6IjZhMzE1Nzk0LTZmMzQtNDYwMS05NDIwLTFiMDM2ZmE3Mjg3MyIsImZhbWlseV9uYW1lIjoiUnVhbiIsImdpdmVuX25hbWUiOiJBbmRyZXciLCJpbl9jb3JwIjoidHJ1ZSIsImlwYWRkciI6IjE5OC4xMDMuMTY3LjIwIiwibmFtZSI6IlJ1YW4sIEFuZHJldyAoU1NDL1NQQykiLCJvaWQiOiJiNTY0YjQ0OC1hMDIyLTRlZDUtOTk0OC00OWI0ZWNiYzYxZTQiLCJvbnByZW1fc2lkIjoiUy0xLTUtMjEtMTA5Nzc0NjYyMi05MTQzODM1OTctMTQ4MTI2ODQwMi00NDIzNjAiLCJyaCI6IjEuQVNrQWxNRmIwTC1VMWtxdUxoMnc4dU9QWGlOZGxGN1pTQ2xKc2FHVHFjcFktS3I0QUJ3cEFBLiIsInJvbGVzIjpbIjBjM2U4OGM5LWI3ZjMtNGM2MC1hNDg2LTdlMTIwYzI3YmJkYiIsIjEwNDM0ZGRiLTIwYWYtNDFhMi1iNGJjLTA2NzM0MGUzNjAxMyIsImU1YjJhMDQxLWY5YTctNDc5ZS05ZjY0LTBhYzU3YTkyYmVjYSIsImMwZWQyNzE2LWEyNTgtNDAyMC1hNTdjLTZkNTExZDU2ZTc3NCIsIjA3ZGQ2YWY5LTVkMzAtNGFjMy04N2JiLWQ2MWEwMzIwZTVjOSIsIjAxNmIxYmVhLTNjZDYtNGE5OC05NWM1LTEwMTJkYjVjNzQzZCIsImY3MmIxOTg2LTZjOTItNDIxNy05OTQ4LWNiMDhiNzM1MzZjNSIsIjU5YzA2YWJjLWY0NGQtNGMxNC04YTNiLWMzZjI1YTU0ZTQ4MSIsIjkyZTdlY2I2LTBlMTctNDc4ZS1iNzFjLTBjZTVmNmUzMjUyOSIsIjFiM2VkZTY5LTJiMjYtNDcwYy04YmUyLTBmMTc5NjRjZDE4MCIsIjc5ZjliYzM1LWJlY2YtNGZhZC04Nzk2LWUwMDU3Njc1ZmY0YyIsIjQzODc4MmE4LWQxOTktNDVlYi1iZWJhLWJhMjQ0Nzc3N2MzMCIsImYxMDExOGMxLWFmMWMtNDk4ZS1hNGVlLTk1OTYyZjhlODQwZiIsImNhNWUwNTgyLTE4NTktNDcwMS1hZTYxLWM5Y2E0MmNlYzUwMyIsImFlYzU4OWJiLWY1NjYtNGIzYi1hNmU2LTNmYTg1OGIwOTQxNiIsImU4YzAzYjBhLTJhODQtNDhhMS04YWEzLTA5MTlkOWE1MjA1YSIsImQ2NjYyNzdlLTdjMGUtNDNjMS05NjAyLTRhNDM5MWEyOTk5MCIsIjg2OGY3ZWE1LWI2NDktNDM5Mi04MWQ0LTU5MmY4YTg1NmI3NCIsImNlZmE3ZDlhLWQ2MzAtNGM0Yi05Y2RlLWE4NzhhYThjMmJlNiIsImJmZDMyYjBmLTdiZWItNGQ2NS04NmI5LTFlZTIzYjRmMmU1OSIsIjEzY2ExYmZiLTEwMmYtNDg5ZS1hMjE0LWVlNTEzNTU1MmUzNyIsIjNkMjdlOTI5LTMwYmYtNDExMS05M2RjLWExZWMwNjFmNDEwNSIsIjMwOTk5NjgzLTU4ZTktNDBiNS1hOTY3LWQ3YjIwNDAzYTFiOCIsImExZTFiNTM5LWU2NDEtNGM5OS1hNGY2LWQzMjQ0YzU3YWY2MyIsIjk5YzRjNjNiLTE0NzItNDljZC1iNGM4LTMyZjY4OTE5NGYzYiIsIjFlYTJiYWYyLWM5ZjktNGFiOS1hYTcwLWQ1NTZmMmUwY2M5YiIsIjcwNjQ0Mzg1LTk2MjYtNDFlMS1iMTgxLWRhZWQxZmU0Yjg1ZiIsImY4Y2JmYzAwLTQwY2YtNGM1Ni1iYWI0LTg4ZTY1OWM4OTFlYSIsIjdiMzg0YzNiLTQ5NTEtNDllMC05ODdhLTQ1OGQ2MjMzZGUzMCIsIjhkZjczY2FlLWQ5MGMtNGI3Ni1hYzQ4LWUzZjFkNTZlMTQzZiIsImIxMWE2MjJlLTBjZjYtNDk1MC04OTQyLWI5NTM1ZjY4YjJlYyIsIjE0MjRkMzE2LTFiNzgtNDI2ZC1iNDRiLTVjMDNhNGQ5MzkxNyJdLCJzY3AiOiJhcGkuYWNjZXNzIiwic2lkIjoiMDAyZjU1NDktNmE0My03YTU4LWNmZjYtNTFlOGViMzk3MzJjIiwic3ViIjoiYV9WSjFDTUl6SlAxSnZfb2xadGY2UVFoQmdnd2FkeE1Wd29SVV9SM084byIsInRpZCI6ImQwNWJjMTk0LTk0YmYtNGFkNi1hZTJlLTFkYjBmMmUzOGY1ZSIsInVuaXF1ZV9uYW1lIjoiYW5kcmV3LnJ1YW5Ac3NjLXNwYy5nYy5jYSIsInVwbiI6ImFuZHJldy5ydWFuQHNzYy1zcGMuZ2MuY2EiLCJ1dGkiOiJTcXNGNmhROWRFT2liZ01BcGcyUEFBIiwidmVyIjoiMS4wIiwieG1zX2Z0ZCI6IkJkQnAtUzcxZE95Ujk4S3JtSWZjbm9lYVROUVRmaWdWbzBfVzZyaWtsallCZFhOdWIzSjBhQzFrYzIxeiJ9.dD4uNtKShXxPVAzW1tQNBgxVrWDqXPU75rNlfHnQUo496nCGwRjtNA8ml5iBNpIOerOUD4woLjWER79ergs6dwq91qesKO2OYuCqNukvfwsf00mKn-lpsFw-si1kferMcCzUXzYH4eOnlVN10UHhmXd9pxGXWlmsjRvlY_LOL4lr-Lrw7XRxYANQg2EwhKrSUNDo2aOp0DHk5vqqkNHpWUeObwpzmWI7SBfHSKJTSCwqvT9Lck2kqDgXG76kBBkF6-vrTxWbzcWZkzCGS2tFCjaC_8V93YCPyODoDuzLO8MQaj3uisD-jp9VqVhjITH4MaLhtMrSvQPUJZvDMHkg7A";

                const transport = new StreamableHTTPClientTransport(baseUrl, {
                requestInit: {
                    headers: {
                        "Authorization": "Bearer " + token,
                    }
                }                
            });

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
