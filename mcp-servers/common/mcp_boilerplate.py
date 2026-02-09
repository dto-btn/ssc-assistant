from mcp.server.fastmcp import FastMCP
import uvicorn
import os
from starlette.middleware.cors import CORSMiddleware
from .auth import MSALAuthMiddleware

def create_secure_mcp_app(mcp: FastMCP):
    """
    Creates a Starlette ASGI app from a FastMCP instance with CORS and MSAL security.
    """
    # Get the base SSE app from FastMCP
    mcp_app = mcp.sse_app()
    
    # 1. Enable CORS (crucial for browser-based tool calls from the Playground)
    mcp_app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # 2. Add MSAL Security Layer
    mcp_app.add_middleware(MSALAuthMiddleware)
    
    # 3. Handle OPTIONS requests robustly
    # Standard Starlette/FastAPI CORS middleware sometimes fails to intercept 
    # OPTIONS requests when using mcp.sse_app() due to how routes are handled.
    async def app_wrapper(scope, receive, send):
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
        
    return app_wrapper

if __name__ == "__main__":
    # Example Usage:
    # mcp = FastMCP("Example Server")
    # app = create_secure_mcp_app(mcp)
    # uvicorn.run(app, host="0.0.0.0", port=8000)
    pass
