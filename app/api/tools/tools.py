import json
import logging
import os
from typing import List

from openai.types.chat import (ChatCompletionMessageParam)
from app.api.utils.decorators import discover_functions_with_metadata

__all__ = ["load_tools", "call_tools"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_allowed_tools_str: str = os.getenv("ALLOWED_TOOLS", "corporate, geds")
_allowed_tools          = [tool.strip() for tool in _allowed_tools_str.split(",")]

_DISCOVERED_FUNCTIONS_WITH_METADATA = discover_functions_with_metadata("tools")

def load_tools(tools_requested: List[str]) -> List[ChatCompletionMessageParam]:
    """
    ONLY load tools if they are:
        1) requested for (tools_requested) AND
        2) part of the _allowed_tools list (set by the system)
    """
    tools = []
    for _, value in _DISCOVERED_FUNCTIONS_WITH_METADATA.items():
        # Ensure BOTH function type is in requested types and ALLOWED types by the system.
        if value['tool_type'] in tools_requested and value['tool_type'] in _allowed_tools:
            tools.append(value['metadata'])
    return tools

def get_functions_by_type(tool_type: str) -> List[str]:
    """
    Return function name by module type
    """
    tools = []
    for _, value in _DISCOVERED_FUNCTIONS_WITH_METADATA.items():
        # Ensure BOTH function type is in requested types and ALLOWED types by the system.
        if tool_type == value['tool_type']:
            tools.append(value['metadata']['function']['name'])
    return tools

def invoke_corporate_function(function_name: str) -> str:
    """invokes a corporate functions to retreive the index name"""
    try:
        module = _DISCOVERED_FUNCTIONS_WITH_METADATA[function_name]['module']
        function_to_call = getattr(module, function_name)
        function_response = function_to_call()
    except Exception as exception:
        e = "Unable to call function"
        logger.error(e, exception)
        function_response = e
    return function_response

def call_tools(tool_calls, messages: List[ChatCompletionMessageParam]) -> List[ChatCompletionMessageParam]:
    """
    Call the tool functions and return a new completion with the results
    """

    # Send the info for each function call and function response to the model
    for tool_call in tool_calls:
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments)

        logger.debug("Func to call:%s and the args; %s", function_name, function_args)

        # Prepare the arguments for the function call
        prepared_args = {arg: function_args[arg] for arg in function_args}

        # Call the function with the prepared arguments
        try:
            module = _DISCOVERED_FUNCTIONS_WITH_METADATA[function_name]['module']
            function_to_call = getattr(module, function_name)
            function_response = function_to_call(**prepared_args)
        except Exception as exception:
            e = "Unable to call function"
            logger.error(e, exception)
            function_response = e

        messages.append({
            "role": "assistant",
            "content": None,
            "function_call": {
                "name": function_name,
                "arguments": json.dumps(function_args)
            }
        })

        # Convert the function response to a JSON string if it's a list or dict
        if isinstance(function_response, (list, dict)):
            response_as_string = json.dumps(function_response)
        else:
            response_as_string = str(function_response)

        # Add the function response to the messages
        messages.append({
            "role": "function",
            "name": function_name,
            "content": response_as_string
        })
        # reworking with this example to refine a bit:
        # https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling?tabs=python#working-with-function-calling
    return messages
