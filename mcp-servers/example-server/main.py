from mcp.server.fastmcp import FastMCP
import uvicorn
import os
import sys
from dotenv import load_dotenv

# Add parent directory to sys.path so we can import 'common'
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from common.mcp_boilerplate import create_secure_mcp_app

# Load environment variables
load_dotenv()

# Initialize FastMCP 
# We set host="0.0.0.0" to disable the default DNS rebinding protection 
# which causes 421 errors when accessed via proxies/tunnels like localtunnel.
mcp = FastMCP("Example Secure Server", host="0.0.0.0")

@mcp.tool()
def echo_securely(message: str) -> str:
    """
    A simple tool that echoes back a message. 
    Only accessible if the caller is authenticated via MSAL.
    """
    return f"Secure Echo: {message}"

@mcp.tool()
def get_system_status() -> dict:
    """
    Returns the status of the example server.
    """
    return {
        "status": "online",
        "auth_enabled": os.getenv("SKIP_USER_VALIDATION", "False").lower() != "true",
        "tenant": os.getenv("AZURE_AD_TENANT_ID", "Not Set")
    }

if __name__ == "__main__":
    # The helper adds CORS, MSAL Auth, and OPTIONS handling
    app = create_secure_mcp_app(mcp)
    
    port = int(os.getenv("PORT", 8000))
    print(f"Starting Secure MCP Server on port {port}...")
    uvicorn.run(app, host="0.0.0.0", port=port)
