import json
import logging
import os

import requests

from .root import api_v2

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, jsonify, request, stream_with_context

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
#api_version             = os.getenv("AZURE_OPENAI_VERSION", "2024-05-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

# Basic CORS configuration for dev. You can set CORS_ALLOW_ORIGIN to a specific origin.
CORS_ALLOW_ORIGIN = os.getenv("CORS_ALLOW_ORIGIN", "*")
CORS_ALLOW_METHODS = "POST, OPTIONS"
CORS_ALLOW_HEADERS = os.getenv("CORS_ALLOW_HEADERS", "Content-Type, Authorization")
CORS_EXPOSE_HEADERS = os.getenv("CORS_EXPOSE_HEADERS", "Content-Type")
CORS_MAX_AGE = os.getenv("CORS_MAX_AGE", "86400")


@api_v2.after_request
def add_cors_headers(response: Response):
    """Attach CORS headers to all responses from this blueprint."""
    # Use wildcard for dev unless a specific origin is configured
    response.headers["Access-Control-Allow-Origin"] = CORS_ALLOW_ORIGIN
    if CORS_ALLOW_ORIGIN != "*":
        # Help caches differentiate responses by Origin
        response.headers["Vary"] = "Origin"
    response.headers["Access-Control-Allow-Methods"] = CORS_ALLOW_METHODS
    response.headers["Access-Control-Allow-Headers"] = CORS_ALLOW_HEADERS
    response.headers["Access-Control-Expose-Headers"] = CORS_EXPOSE_HEADERS
    response.headers["Access-Control-Max-Age"] = CORS_MAX_AGE
    return response


@api_v2.route("/azure/<path:subpath>", methods=["OPTIONS"])
def openai_chat_completions_options(_subpath: str):  # pragma: no cover - trivial CORS preflight
    """Handle CORS preflight for the Azure proxy endpoint."""
    return Response(status=204)

@api_v2.post("/azure/<path:subpath>")
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
        logger.exception("Unexpected error in OpenAI proxy")
        return jsonify({"error": {"message": f"Unexpected error: {str(e)}"}}), 500
