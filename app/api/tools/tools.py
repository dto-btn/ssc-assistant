import json
import logging
import os
import re
from pathlib import Path
from typing import List

import requests
from openai.types.chat import (ChatCompletionMessageParam)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_allowed_tools_str: str = os.getenv("ALLOWED_TOOLS", "intranet")
_allowed_tools          = _allowed_tools_str.split(",")

# Always present tool (mapped outside via data source, else move inside a module if this method changes)
_intranet_json = '''
{
    "type": "function",
    "tool_type": "intranet",
    "function": {
      "name": "intranet_question",
      "description": "Answers questions that are related to Shared Services Canada (SSC) / Services Partagés Canada (SPC) or any corporate questions related to the intranet website (MySSC+/MonSPC+) or anything that could be found on it. It could be accomodations, finance, workplace tools, HR information, anything an employee could need as information in a day to day job.",
      "parameters": {
        "type": "object",
        "properties": {
          "query": {
            "type": "string",
            "description": "The question that relates to anything corporate or SSC"
          }
        },
        "required": ["query"]
      }
    }
  }
'''

_allowed_tools.append(json.loads(_intranet_json))

# Get the directory of the current file (tools.py)
_current_dir = Path(__file__).parent
# Construct the path to 'tools.json' within the same directory
_tools_path = _current_dir / 'tools.json'
# Open the file using the absolute path
with _tools_path.open('r') as f:
    _all_tools = json.load(f)

def load_tools(toolsUsed: List[str]):
    tools = [tool for tool in _all_tools if 'tool_type' in tool and tool['tool_type'] in toolsUsed]
    return tools

def call_tools(tool_calls, messages: List[ChatCompletionMessageParam]) -> List[ChatCompletionMessageParam]:
    """
    Call the tool functions and return a new completion with the results
    """
    # Define the available functions
    available_functions = {
        "get_employee_information": get_employee_information,
        "get_employee_by_phone_number": get_employee_by_phone_number
    }

    # Send the info for each function call and function response to the model
    for tool_call in tool_calls:
        function_name = tool_call.function.name
        if function_name in available_functions:
            function_to_call = available_functions[function_name]
            function_args = json.loads(tool_call.function.arguments)

            # Prepare the arguments for the function call
            prepared_args = {arg: function_args[arg] for arg in function_args}

            # Call the function with the prepared arguments
            function_response = function_to_call(**prepared_args)
            
            messages.append({
                "role": "assistant",
                "content": None,
                "function_call": {
                    "name": function_name,
                    "arguments": json.dumps(function_args)
                }
            })

            # Convert the function response to a string
            response_as_string = "\n".join(function_response) if function_response is list else str(function_response)

            # Add the function response to the messages
            messages.append({
                "role": "function",
                "name": function_name,
                "content": response_as_string
            })
            # reworking with this example to refine a bit:
            # https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling?tabs=python#working-with-function-calling
    return messages