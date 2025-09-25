import json
import logging
import os

from apiflask import APIBlueprint
import requests

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, jsonify, request, stream_with_context

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")

#service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
#key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

proxy_azure = APIBlueprint("proxy_azure", __name__)

@proxy_azure.post("<path:subpath>")
def openai_chat_completions(subpath: str):
    """
    OpenAI-compatible chat completions endpoint.

    This endpoint accepts requests in the OpenAI API format and proxies them to Azure OpenAI.
    It allows the frontend to use the OpenAI SDK with a custom base URL pointing to this route.
    """
    try:
        data = request.json

        # Basic validation
        if not data or "messages" not in data:
            return jsonify({"error": "Missing messages in request body"}), 400

        # Extract request parameters
        messages = data.get("messages", [])
        max_tokens = data.get("max_tokens", 500)
        stream = data.get("stream", False)

        # Get Azure OpenAI API details
        api_url = f"{os.getenv('AZURE_OPENAI_ENDPOINT')}/{subpath}"

        # Forward query parameters (e.g., api-version)
        query_params = request.args.to_dict(flat=False)

        # Use Azure AD authentication if available
        headers = {
            "Content-Type": "application/json",
        }

        token = token_provider()
        headers["Authorization"] = f"Bearer {token}"

        # Prepare the request payload
        payload = {"messages": messages, "max_tokens": max_tokens, "stream": stream}
        if data.get("tools"):
            # If tools are provided, add them to the payload
            payload["tools"] = data["tools"]

        # Forward optional parameters if present in the original request
        for param in [
            "temperature",
            "top_p",
            "frequency_penalty",
            "presence_penalty",
            "stop",
        ]:
            if param in data:
                payload[param] = data[param]
        # Handle streaming responses
        if stream:
            def generate():
                # Make request to Azure OpenAI with streaming enabled
                response = requests.post(
                    api_url, headers=headers, json=payload, params=query_params, stream=True, timeout=60
                )

                # Check for errors
                if response.status_code != 200:
                    error_content = response.content.decode("utf-8")
                    logger.error("Azure OpenAI API error: %s", error_content)
                    # Format error as SSE
                    yield f"data: {json.dumps({'error': {'message': f'Azure OpenAI API error: {error_content}'}})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                # Stream response chunks
                for chunk in response.iter_lines(decode_unicode=True):
                    if chunk:
                        # Skip the "data: " prefix if it exists in Azure's response
                        if chunk.startswith("data: "):
                            chunk = chunk[6:]
                        # Only yield non-empty lines
                        if chunk.strip():
                            # Format as SSE
                            yield f"data: {chunk}\n\n"

                yield "data: [DONE]\n\n"

            # Return streaming response
            return Response(
                stream_with_context(generate()),
                content_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        response = requests.post(
            api_url, headers=headers, json=payload, params=query_params, timeout=30
        )

        response_status = response.status_code
        response_content = response.content

        return Response(
            response_content,
            status=response_status,
            content_type = response.headers.get(
                "Content-Type", "application/json"
            )
        )

    except Exception as e:
        logger.exception("Unexpected error in OpenAI azure_proxy :%s", e)
        return jsonify({"error": {"message": "An internal error has occurred."}}), 500
