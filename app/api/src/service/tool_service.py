import json
import logging
import os
from typing import Any, List

from openai.types.chat import ChatCompletionMessageParam, ChatCompletionMessageToolCallParam
from src.constants.tools import TOOL_CORPORATE, TOOL_GEDS
from tools.geds.geds_functions import extract_geds_profiles
from utils.decorators import discover_functions_with_metadata
from utils.models import ToolInfo

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_DISCOVERED_FUNCTIONS_WITH_METADATA = discover_functions_with_metadata("tools")

class ToolService:
    """ Tool Service responsible for handling logic for tools, 
    such as adding tools payload to messages returned to the consumer of the API
    """
    def __init__(self, requested_tools: List[str]):
        _allowed_tools_str: str = os.getenv("ALLOWED_TOOLS") or ",".join([TOOL_CORPORATE, TOOL_GEDS])
        self.allowed_tools = [tool.strip() for tool in _allowed_tools_str.split(",")]
        self.tools = self._load_tools(requested_tools)

    def process_messages(self, messages: List[ChatCompletionMessageParam], tools: List[Any]) -> ToolInfo:
        """
        Process the message and create an appropriate ToolInfo object based on the content of the messages
        """
        tools_info = ToolInfo()
        function_to_tool_type = {tool['function']['name']: tool['tool_type']
                                for tool in tools if tool.get('type') == 'function'}
        for message in messages:
            if message["role"] == "function":
                function_name = message["name"]
                tools_info.function_names.append(function_name)

                if function_name in function_to_tool_type:
                    tool_name = function_to_tool_type[function_name]
                    tools_info.tool_type.append(tool_name)

                    # extract profiles if it's a geds function
                    if tool_name == "geds":
                        content = message.get("content", "")
                        profiles = extract_geds_profiles(content)
                        if profiles:
                            tools_info.payload = {"profiles": profiles}

                    if tool_name == "bits":
                        # all bits response are in json, so just convert them
                        content = message.get("content", "[]")  # Default to an empty JSON object string
                        if content is not None:
                            try:
                                json_content = json.loads(content)
                                if function_name not in tools_info.payload:
                                    # Initialize as an empty list if the key doesn't exist
                                    tools_info.payload[function_name] = []
                                if isinstance(json_content, list):
                                    tools_info.payload[function_name].extend(json_content) # type: ignore
                                else:
                                    # If tools_info.payload[function_name] is not a list, handle appropriately
                                    tools_info.payload[function_name] = [json_content]
                            except json.JSONDecodeError:
                                # Handle the case where the JSON is invalid
                                tools_info.payload = {}
                        else:
                            tools_info.payload = {}

                if function_name == "get_available_rooms":
                    content = message.get("content", "")
                    if content is not None:
                        try:
                            data = json.loads(content)
                        except json.JSONDecodeError:
                            logger.warning("Content is not valid JSON: %s", content)
                            data = {}
                        if data.get("floorPlan") is not None:
                            floor_plan = data.get("floorPlan")
                            logger.debug("FLOOR PLAN: %s", floor_plan)
                            if floor_plan:
                                tools_info.payload = {"floorPlan": floor_plan}

                if function_name == "verify_booking_details":
                    content = message.get("content", "")
                    if content is not None:
                        booking_details = json.loads(content)
                        logger.debug("BOOKING DETAILS %s", booking_details)
                        tools_info.payload = {"bookingDetails": booking_details}

        return tools_info

    #
    # Phasing this out of the code for now, keeping it for a bit un case we need to revert in the coming months.
    #
    # def get_functions_by_type(self, tool_type: str) -> List[str]:
    #     """
    #     Return function name by module type
    #     """
    #     tools = []
    #     for _, value in _DISCOVERED_FUNCTIONS_WITH_METADATA.items():
    #         # Ensure BOTH function type is in requested types and ALLOWED types by the system.
    #         if tool_type == value['tool_type']:
    #             tools.append(value['metadata']['function']['name'])
    #     return tools

    # def invoke_corporate_function(self, function_name: str) -> str:
    #     """invokes a corporate functions to retreive the index name"""
    #     try:
    #         logger.debug("Invoking corporate function --> %s", function_name)
    #         module = _DISCOVERED_FUNCTIONS_WITH_METADATA[function_name]['module']
    #         function_to_call = getattr(module, function_name)
    #         function_response = function_to_call()
    #     except Exception as exception:
    #         e = "Unable to call function"
    #         logger.error(e, exception)
    #         function_response = e
    #     return function_response

    def call_tools(self, tool_calls: List[ChatCompletionMessageToolCallParam], messages: List[ChatCompletionMessageParam]) -> List[ChatCompletionMessageParam]:
        """
        Call the tool functions and return a new completion with the results
        """

        # Send the info for each function call and function response to the model
        for tool_call in self.tools:
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

    def _process_message_for_geds(self, tool: str,
                                  messages: List[ChatCompletionMessageParam],
                                  tools_info: ToolInfo):
        """
        Process the message for geds tool
        """


    def _process_message_for_archibus(self, tool: str,
                                  messages: List[ChatCompletionMessageParam],
                                  tools_info: ToolInfo):
        """
        Process the message for archibus tool
        """


    def _process_message_for_bits(self, tool: str,
                                  messages: List[ChatCompletionMessageParam],
                                  tools_info: ToolInfo):
        """
        Process the message for bits (br) tool
        """

    def _load_tools(self, tools_requested: List[str]) -> List[ChatCompletionMessageToolCallParam]:
        """
        ONLY load tools if they are:
            1) requested for (tools_requested) AND
            2) part of the _allowed_tools list (set by the system)
        """
        tools = []
        for _, value in _DISCOVERED_FUNCTIONS_WITH_METADATA.items():
            # Ensure BOTH function type is in requested types and ALLOWED types by the system.
            if value['tool_type'] in tools_requested and value['tool_type'] in self.allowed_tools:
                tools.append(value['metadata'])
        return tools
