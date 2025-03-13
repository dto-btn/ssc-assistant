import json
import logging
import os
from typing import List

from openai.types.chat import ChatCompletionMessageParam, ChatCompletionMessageToolCall
from src.constants.tools import TOOL_CORPORATE, TOOL_GEDS, TOOL_ARCHIBUS, TOOL_BR
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
        self.tools_info = ToolInfo()

    def get_functions_by_type(self, tool_type: str) -> List[str]:
        """
        Return function name by module type
        """
        tools = []
        for _, value in _DISCOVERED_FUNCTIONS_WITH_METADATA.items():
            # Ensure BOTH function type is in requested types and ALLOWED types by the system.
            if tool_type == value['tool_type']:
                tools.append(value['metadata']['function']['name'])
        return tools

    def call_tools(self, tool_calls: List[ChatCompletionMessageToolCall], messages: List[ChatCompletionMessageParam]) -> List[ChatCompletionMessageParam]: # pylint: disable=line-too-long
        """
        Call the tool functions and return a new completion with the results
        """
        returned_messages = messages
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

            returned_messages.append({
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
            returned_messages.append({
                "role": "function",
                "name": function_name,
                "content": response_as_string
            })

            # Here we process the "message" so we can collect the function called and return it in a different format.
            self._process_function_for_payload(function_name,response_as_string)
            # reworking with this example to refine a bit:
            # https://learn.microsoft.com/en-us/azure/ai-services/openai/how-to/function-calling?tabs=python#working-with-function-calling
        return returned_messages

    def _process_function_for_payload(self, function_name: str, response_as_string: str):
        """
        Process the function response for payload
        """
        for tool in self.tools:
            if function_name is not None and tool['function']['name'] == function_name:
                tool_type = tool['tool_type']
                # we add the information to the tools_info object regardless if we got data or not with it.
                self.tools_info.function_names.append(function_name)
                self.tools_info.tool_type.append(tool_type)
                data = {}
                if tool_type == TOOL_GEDS:
                    data = self._process_geds_function_for_payload(function_name, response_as_string)
                elif tool_type == TOOL_CORPORATE:
                    pass
                elif tool_type == TOOL_ARCHIBUS:
                    data = self._process_archibus_function_for_payload(function_name, response_as_string)
                elif tool_type == TOOL_BR:
                    data = self._process_br_function_for_payload(function_name, response_as_string)

                if data:
                    # here we will update the payload dictionary with some logic
                    for key, value in data.items():
                        if key in self.tools_info.payload:
                            logger.debug("Key Found!: %s", key)
                            if isinstance(self.tools_info.payload[key], list) and isinstance(value, list):
                                logger.debug("Extending List: %s", key)
                                self.tools_info.payload[key].extend(value) # type: ignore
                            elif isinstance(self.tools_info.payload[key], dict) and isinstance(value, dict):
                                logger.debug("Updating Dict: %s", key)
                                self.tools_info.payload[key].update(value) # type: ignore
                            else:
                                # Handle potential type conflicts or other logic
                                pass
                        else:
                            self.tools_info.payload[key] = value


    def _process_geds_function_for_payload(self, function_name: str, response_as_string: str) -> dict | None:
        """
        Process the message for geds tool
        """
        if function_name == "get_employee_information":
            if response_as_string is not None:
                profiles = extract_geds_profiles(response_as_string)
                if profiles:
                    return {"profiles": profiles}

    def _process_archibus_function_for_payload(self, function_name: str, response_as_string: str) -> dict | None:
        """
        Process the message for archibus tool
        """
        if function_name == "get_available_rooms":
            if response_as_string is not None:
                try:
                    data = json.loads(response_as_string)
                except json.JSONDecodeError:
                    logger.warning("Content is not valid JSON: %s", response_as_string)
                    data = {}
                if data.get("floorPlan") is not None:
                    floor_plan = data.get("floorPlan")
                    logger.debug("FLOOR PLAN: %s", floor_plan)
                    if floor_plan:
                        return {"floorPlan": floor_plan}

        if function_name == "verify_booking_details":
            if response_as_string is not None:
                booking_details = json.loads(response_as_string)
                logger.debug("BOOKING DETAILS %s", booking_details)
                return {"bookingDetails": booking_details}


    def _process_br_function_for_payload(self, function_name: str, response_as_string: str) -> dict | None:
        """
        Process the message for bits (br) tool
        """
        if response_as_string is not None:
            try:
                json_content = json.loads(response_as_string)
                return json_content
            except json.JSONDecodeError:
                logger.warning("Content is not valid JSON: %s", response_as_string)

    def _load_tools(self, tools_requested: List[str]) -> List[dict]:
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
