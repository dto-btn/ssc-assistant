import osimport os

import requestsimport requests

from json import JSONDecodeErrorfrom json import JSONDecodeError

from fastmcp import FastMCPfrom fastmcp import FastMCP



# Create an MCP server# Create an MCP server

mcp = FastMCP(mcp = FastMCP(

    "Shared Services Canada Assistant MCP Server",    "Shared Services Canada Assistant MCP Server",

    host="0.0.0.0",    host="0.0.0.0",

    port=8000,    port=8000,

    stateless_http=True,    stateless_http=True,

))



OPEN_PARLIAMENT_API_BASE = os.getenv("OPEN_PARLIAMENT_API_BASE", "https://api.openparliament.ca")OPEN_PARLIAMENT_API_BASE = os.getenv("OPEN_PARLIAMENT_API_BASE", "https://api.openparliament.ca")





# Query OpenParliament for the list of Canadian MPs# Query OpenParliament for the list of Canadian MPs

@mcp.tool()@mcp.tool()

def list_all_mps() -> list[dict[str, str]]:def list_all_mps() -> list[dict[str, str]]:

    """List all Canadian Members of Parliament"""    """List all Canadian Members of Parliament"""

    try:    try:

        response = requests.get(        response = requests.get(

            f"{OPEN_PARLIAMENT_API_BASE}/politicians/?include=all",            f"{OPEN_PARLIAMENT_API_BASE}/politicians/?include=all",

            headers={"Accept": "application/json"}            headers={"Accept": "application/json"}

        )        )

        response.raise_for_status()        response.raise_for_status()

        data = response.json()        data = response.json()



        return [{"name": mp["name"]} for mp in data["objects"]]        return [{"name": mp["name"]} for mp in data["objects"]]



    except requests.RequestException as e:    except requests.RequestException as e:

        return [{"error": f"Failed to fetch MPs: {str(e)}"}]        return [{"error": f"Failed to fetch MPs: {str(e)}"}]



    except JSONDecodeError:    except JSONDecodeError:

        return [{"error": "Failed to decode JSON response"}]        return [{"error": "Failed to decode JSON response"}]





@mcp.tool()@mcp.tool()

def get_total_mps() -> int:def get_total_mps() -> int:

    """Get the total number of Canadian Members of Parliament"""    """Get the total number of Canadian Members of Parliament"""

    return 225    return 225





if __name__ == "__main__":if __name__ == "__main__":

    mcp.run()    mcp.run()
