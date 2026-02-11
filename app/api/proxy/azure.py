import json
import logging
import os
import uuid

from apiflask import APIBlueprint
import requests

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, abort, request, stream_with_context, g

from utils.auth import user_ad
from proxy.common import PROXY_TIMEOUT, upstream_headers, stream_response
from src.service.mcp_service import MCPService

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

ROOT_PATH_PROXY_AZURE = "/proxy/azure"

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")

proxy_azure = APIBlueprint("proxy_azure", __name__)

@proxy_azure.post("<path:subpath>")
@user_ad.login_required
def openai_chat_completions(subpath: str):
    """
    OpenAI-compatible chat completions endpoint with server-side MCP tool execution.
    """
    req_id = request.headers.get("x-request-id") or str(uuid.uuid4())
    upstream_url = f"{azure_openai_uri}/openai/{subpath}"

    user_token = g.user.token if hasattr(g, 'user') and g.user and g.user.token else None
    user = user_token.get('oid') if user_token else "anon"
    logger.info("AOAI proxy start req_id=%s user=%s method=%s path=%s", req_id, user, request.method, upstream_url)

    try:
        token = token_provider()
        headers = upstream_headers(request.headers, f"Bearer {token}")
        
        # Only apply MCP logic to chat/completions
        if "chat/completions" in subpath and request.method == "POST":
            body = request.get_json(silent=True)
            if not body:
                # Fallback to standard proxy
                return _standard_proxy(request.method, upstream_url, headers, request.get_data(), req_id)

            mcp_service = MCPService()
            mcp_tools = mcp_service.get_all_tools()
            
            # Inject MCP tools
            if mcp_tools:
                existing_tools = body.get("tools", [])
                tool_names = [t["function"]["name"] for t in existing_tools if t.get("type") == "function"]
                for tool in mcp_tools:
                    if tool["function"]["name"] not in tool_names:
                        existing_tools.append(tool)
                body["tools"] = existing_tools

            # Handle the Tool Call Loop server-side
            # 1. First call (check for tool calls)
            is_streaming = body.get("stream", False)
            
            # Temporarily disable streaming to handle potential tool calls
            # unless we are sure no tool call will happen (but we can't know)
            # A more advanced version would handle streaming tool calls.
            # Here we follow a simple loop.
            
            temp_body = body.copy()
            temp_body["stream"] = False # Must be False for easy tool-call loop
            
            while True:
                # If it's the final response (likely), we check if we should stream it
                # But we don't know if it's the final one until we get the response.
                # So we always get a non-streamed response first to check for tool calls.
                response = requests.post(upstream_url, headers=headers, json=temp_body, timeout=PROXY_TIMEOUT)
                if not response.ok:
                    return Response(response.content, status=response.status_code, headers=dict(response.headers))
                
                resp_json = response.json()
                choices = resp_json.get("choices", [])
                if not choices:
                    return Response(json.dumps(resp_json), status=response.status_code)
                
                message = choices[0].get("message", {})
                tool_calls = message.get("tool_calls")
                
                if not tool_calls:
                    # No more tool calls. 
                    # If the user originally requested a stream, we can't easily "un-get" the json
                    # and re-stream the same content.
                    # Workaround: just return the JSON as a single-chunk stream or just the JSON.
                    # Most SDKs handle the transition from stream=True to a single JSON response if handled correctly.
                    # However, to be perfect, we should re-call AOAI with stream=True for the final output.
                    if is_streaming:
                        temp_body["stream"] = True
                        # Re-call for final stream
                        def stream_final():
                            with requests.post(upstream_url, headers=headers, json=temp_body, stream=True, timeout=PROXY_TIMEOUT) as r:
                                yield from stream_response(r)
                        return Response(stream_with_context(stream_final()), headers={"X-Accel-Buffering": "no"})
                    
                    return Response(json.dumps(resp_json), status=200, content_type="application/json")
                
                # Execute tool calls and continue loop
                temp_body["messages"].append(message)
                for tc in tool_calls:
                    func_name = tc["function"]["name"]
                    args = json.loads(tc["function"]["arguments"])
                    logger.info("Executing MCP tool call: %s", func_name)
                    
                    result = mcp_service.call_tool_sync(func_name, args)
                    
                    temp_body["messages"].append({
                        "role": "tool",
                        "tool_call_id": tc["id"],
                        "content": result
                    })
                # loop continues to requests.post...

        # Standard proxy for other endpoints (or fallback)
        return _standard_proxy(request.method, upstream_url, headers, request.get_data(), req_id)

    except requests.Timeout:
        logger.exception("AOAI proxy timeout req_id=%s", req_id)
        return Response("Upstream timeout", status=504)
    except Exception:
        logger.exception("AOAI proxy error req_id=%s", req_id)
        return Response("Proxy error", status=502)

def _standard_proxy(method, url, headers, data, req_id):
    def generate():
        with requests.request(
            method, url, headers=headers, data=data, 
            stream=True, timeout=PROXY_TIMEOUT, params=request.args
        ) as r:
            yield from stream_response(r)
    return Response(stream_with_context(generate()), headers={"X-Accel-Buffering": "no"})
