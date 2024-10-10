import importlib.util
import json
import logging
import os
import re
from pathlib import Path
from typing import List

from openai.types.chat import (ChatCompletionMessageParam)

__all__ = ["load_tools", "call_tools"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_allowed_tools_str: str = os.getenv("ALLOWED_TOOLS", "corporate, geds")
_allowed_tools          = [tool.strip() for tool in _allowed_tools_str.split(",")]

_functions_with_metadata = None  # Global variable to store discovered functions

def discover_functions_with_metadata(base_path):
    functions_with_metadata = {}

    for root, _, files in os.walk(base_path):
        for file in files:
            if file.endswith("_functions.py"):
                module_path = Path(root) / file
                module_name = f"{root.replace(os.sep, '.')}.{file[:-3]}"

                spec = importlib.util.spec_from_file_location(module_name, module_path)
                if spec is not None and spec.loader is not None:
                    module = importlib.util.module_from_spec(spec)
                    spec.loader.exec_module(module)

                    # Extract tool_type from the file name
                    tool_type = file[:-3].split('_functions')[0]

                    # Check if tool_type is defined inside the module
                    if hasattr(module, 'TOOL_TYPE'):
                        tool_type = getattr(module, 'TOOL_TYPE')

                    for attr_name in dir(module):
                        attr = getattr(module, attr_name)
                        if callable(attr) and hasattr(attr, "_tool_metadata"):
                            metadata = attr._tool_metadata
                            metadata['tool_type'] = tool_type # also add tool type on top of the rest of things
                    functions_with_metadata[metadata["function"]["name"]] = {'metadata': metadata, 'module': module, 'tool_type': tool_type}
    logger.debug(f"FUNCTIONS WITH METADATA: {functions_with_metadata}")
    return functions_with_metadata

def get_functions_with_metadata():
    global _functions_with_metadata
    if _functions_with_metadata is None:
        # Discover functions only once
        base_path = "tools"
        _functions_with_metadata = discover_functions_with_metadata(base_path)
    return _functions_with_metadata

def load_tools(tools_requested: List[str]) -> List[ChatCompletionMessageParam]:
    """
    ONLY load tools if they are:
        1) requested for (tools_requested) AND
        2) part of the _allowed_tools list (set by the system)
    """
    tools = []
    for _, value in get_functions_with_metadata().items():
        # Ensure BOTH function type is in requested types and ALLOWED types by the system.
        if value['tool_type'] in tools_requested and value['tool_type'] in _allowed_tools:
            tools.append(value['metadata'])
    return tools

def call_tools(tool_calls, messages: List[ChatCompletionMessageParam]) -> List[ChatCompletionMessageParam]:
    """
    Call the tool functions and return a new completion with the results
    """

    # Send the info for each function call and function response to the model
    for tool_call in tool_calls:
        function_name = tool_call.function.name
        function_args = json.loads(tool_call.function.arguments)

        logger.debug(f"Func to call:{function_name} and the args; {function_args}")

        # Prepare the arguments for the function call
        prepared_args = {arg: function_args[arg] for arg in function_args}

        # Call the function with the prepared arguments
        try:
            module = get_functions_with_metadata()[function_name]['module']
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

        # Convert the function response to a string
        response_as_string = "\n".join(function_response) if function_response is list else str(function_response) # type: ignore

        # Add the function response to the messages
        messages.append({
            "role": "function",
            "name": function_name,
            "content": response_as_string
        })
        # reworking with this example to refine a bit:
        # https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling?tabs=python#working-with-function-calling
    return messages