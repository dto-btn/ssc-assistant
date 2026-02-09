from mcp.server.fastmcp import FastMCP
import requests
import os

# Get SearXNG URL from environment or use default
SEARXNG_URL = os.getenv("SEARXNG_URL", "http://localhost:9090")

mcp = FastMCP("SearXNG Search")

@mcp.tool()
def search(query: str, categories: str = "general", language: str = "en-US") -> str:
    """
    Search the web using SearXNG. Use this tool when you need to find information on the internet.
    
    Args:
        query: The search query.
        categories: Comma-separated list of categories to search (e.g., general, images, news).
        language: The language of the search results.
    """
    params = {
        "q": query,
        "categories": categories,
        "language": language,
        "format": "json"
    }
    try:
        response = requests.get(f"{SEARXNG_URL}/search", params=params)
        response.raise_for_status()
        data = response.json()
        
        results = []
        for result in data.get("results", [])[:10]: # Top 10 results
            title = result.get('title', 'No Title')
            url = result.get('url', 'No URL')
            content = result.get('content', 'No Content')
            results.append(f"Title: {title}\nURL: {url}\nSnippet: {content}\n---")
        
        if not results:
            return "No results found."
            
        return "\n".join(results)
    except Exception as e:
        return f"Error during search: {str(e)}"

if __name__ == "__main__":
    import uvicorn
    from starlette.middleware.cors import CORSMiddleware
    
    # Get the MCP ASGI app
    mcp_app = mcp.sse_app() 
    
    # Enable CORS for browser access for non-OPTIONS requests
    mcp_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
    
    # Standard Starlette/FastAPI CORS middleware sometimes fails to intercept 
    # OPTIONS requests when using mcp.sse_app() due to how routes are handled.
    # This pure ASGI middleware guarantees that all OPTIONS requests are 
    # handled with the correct CORS headers, preventing 405 Method Not Allowed errors.
    async def app(scope, receive, send):
        if scope["type"] == "http" and scope.get("method") == "OPTIONS":
            await send({
                "type": "http.response.start",
                "status": 204,
                "headers": [
                    (b"access-control-allow-origin", b"*"),
                    (b"access-control-allow-methods", b"*"),
                    (b"access-control-allow-headers", b"*"),
                    (b"access-control-max-age", b"86400"),
                ],
            })
            await send({"type": "http.response.body", "body": b""})
            return
        await mcp_app(scope, receive, send)
    
    # Run the server on port 8000
    uvicorn.run(app, host="0.0.0.0", port=8000)
