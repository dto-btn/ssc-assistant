import logging
import os
from typing import Iterable
import uuid

from apiflask import APIBlueprint
from psycopg import logger
import requests

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from flask import Response, abort, request, stream_with_context

__all__ = ["upstream_headers", "filtered_response_headers", "stream_response"]

HOP_BY_HOP_BASE = {
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade",
}

PROXY_TIMEOUT = float(os.getenv("PROXY_TIMEOUT_SECONDS", "600"))

def upstream_headers(incoming, auth_header_value=None) -> dict:
    """ 

    Construct headers for the upstream request to Azure OpenAI.
    This includes passing through select headers from the incoming request.
    Will inject the default token if available from DefaultAzureCredential.

    Incoming keys are case-insensitive.

    optional auth_header_value: if provided, will set the Authorization header to this value.

    """
    headers = {}
    # Pass through common headers that matter to AOAI
    allow_list = [
        "accept", "content-type", "x-ms-useragent", "openai-organization",
        "accept-encoding",
    ]
    for k, v in incoming.items():
        lk = k.lower()
        if lk in allow_list:
            headers[k] = v

    if auth_header_value:
        headers["Authorization"] = auth_header_value

    # Ensure we do not forward browser-originating cookies or auth
    headers.pop("Cookie", None)
    return headers

def stream_response(r: requests.Response) -> Iterable[bytes]:
    """ Stream the response content from requests.Response r """
    for chunk in r.iter_content(chunk_size=None):
        if chunk:
            logger.debug("AOAI proxy chunk size=%d", len(chunk))
            yield chunk

def filtered_response_headers(r: requests.Response) -> Iterable[tuple[str, str]]:
    """ Filter out hop-by-hop headers as per RFC 2616 Section 13.5.1 """
    # Start with base hop-by-hop headers
    hop_by_hop = set(HOP_BY_HOP_BASE)

    # Add any tokens declared in the upstream Connection header
    conn_header = r.headers.get("Connection")
    if conn_header:
        for token in conn_header.split(","):
            t = token.strip().lower()
            if t:
                hop_by_hop.add(t)

    for k, v in r.headers.items():
        if k.lower() in hop_by_hop:
            continue
        yield (k, v)

    # Disable buffering for SSE in many reverse proxies
    yield ("X-Accel-Buffering", "no")