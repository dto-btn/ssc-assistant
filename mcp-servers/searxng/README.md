# SearXNG MCP Server

This directory contains a Model Context Protocol (MCP) server that provides web search capabilities using SearXNG.

## Components

1.  **SearXNG**: The search engine aggregator.
2.  **SearXNG MCP Wrapper**: A Python app using `mcp` SDK to expose SearXNG search as MCP tools.

## How to run

Use the provided `docker-compose.searxng.yml` file in the project root:

```bash
docker-compose -f docker-compose.searxng.yml up --build
```

This will start:
-   SearXNG on `http://localhost:9090`
-   SearXNG MCP server on `http://localhost:8000/sse`

## Configuration

The playground is configured to use this MCP server via the `VITE_MCP_SERVERS` environment variable in `app/frontend/.env`.

```json
{
  "type": "mcp",
  "server_label": "SearXNG",
  "server_description": "Web search using SearXNG MCP server",
  "server_url": "http://localhost:8000/sse",
  "require_approval": "never"
}
```

## Tools Provided

-   `search(query: str, categories: str, language: str)`: Searches the web and returns top results.
