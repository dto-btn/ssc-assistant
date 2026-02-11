import asyncio
import json
import logging
import os
from typing import List, Dict, Any, Optional
from mcp import ClientSession
from mcp.client.sse import sse_client
from utils.models import PlaygroundMCPServer

logger = logging.getLogger(__name__)

class MCPService:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MCPService, cls).__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self.servers = self._load_servers()
        self._tool_cache = {} # tool_name -> server_url
        self._initialized = True

    def _load_servers(self) -> List[PlaygroundMCPServer]:
        raw_servers = os.getenv("MCP_SERVERS")
        if not raw_servers:
            return []
        try:
            servers_list = json.loads(raw_servers)
            return [
                PlaygroundMCPServer(
                    server_label=s.get("server_label", "Unknown"),
                    server_description=s.get("server_description", ""),
                    server_url=s.get("server_url", ""),
                    require_approval=s.get("require_approval", "never"),
                    type=s.get("type", "mcp")
                )
                for s in servers_list
            ]
        except Exception as e:
            logger.error(f"Failed to load MCP servers from env: {e}")
            return []

    async def _fetch_tools_from_server(self, server: PlaygroundMCPServer) -> List[Dict[str, Any]]:
        logger.debug(f"Fetching tools from MCP server: {server.server_label} at {server.server_url}")
        try:
            async with sse_client(server.server_url) as (read, write):
                async with ClientSession(read, write) as session:
                    await session.initialize()
                    tools_result = await session.list_tools()
                    tools_list = []
                    for tool in tools_result.tools:
                        tools_list.append({
                            "type": "function",
                            "function": {
                                "name": tool.name,
                                "description": tool.description,
                                "parameters": tool.inputSchema
                            }
                        })
                        self._tool_cache[tool.name] = server.server_url
                    return tools_list
        except Exception as e:
            logger.warning(f"Could not reach MCP server {server.server_label}: {e}")
            return []

    def get_all_tools(self) -> List[Dict[str, Any]]:
        """Sync wrapper to get all tools from all servers."""
        all_tools = []
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            tasks = [self._fetch_tools_from_server(s) for s in self.servers]
            results = loop.run_until_complete(asyncio.gather(*tasks))
            for tools in results:
                all_tools.extend(tools)
            loop.close()
        except Exception as e:
            logger.error(f"Error gathering MCP tools: {e}")
        return all_tools

    async def _execute_tool_call(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        server_url = self._tool_cache.get(tool_name)
        servers_to_try = self.servers
        if server_url:
            # Reorder to try cached server first
            servers_to_try = sorted(self.servers, key=lambda s: s.server_url != server_url)

        for server in servers_to_try:
            try:
                async with sse_client(server.server_url) as (read, write):
                    async with ClientSession(read, write) as session:
                        await session.initialize()
                        tools = await session.list_tools()
                        if any(t.name == tool_name for t in tools.tools):
                            logger.info(f"Executing MCP tool {tool_name} on {server.server_label}")
                            result = await session.call_tool(tool_name, arguments)
                            # Result content handling
                            content_data = []
                            for p in result.content:
                                if hasattr(p, 'model_dump'):
                                    content_data.append(p.model_dump())
                                elif hasattr(p, 'dict'):
                                    content_data.append(p.dict())
                                else:
                                    content_data.append(str(p))
                            return json.dumps(content_data)
            except Exception as e:
                logger.error(f"Failed to execute tool {tool_name} on {server.server_label}: {e}")
                continue
        
        return json.dumps([{"type": "text", "text": f"Error: Tool {tool_name} not found or execution failed."}])

    def call_tool_sync(self, tool_name: str, arguments: Dict[str, Any]) -> str:
        """Sync wrapper to execute a tool call."""
        try:
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            result = loop.run_until_complete(self._execute_tool_call(tool_name, arguments))
            loop.close()
            return result
        except Exception as e:
            logger.error(f"Error executing MCP tool sync: {e}")
            return json.dumps([{"type": "text", "text": f"Exception during MCP call: {str(e)}"}])
