import json
import logging
import os
from typing import Any, List, Optional, Tuple, Union

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI, Stream
from openai.types.chat import (ChatCompletion, ChatCompletionChunk,
                               ChatCompletionMessageParam)
from openai.types.completion_usage import CompletionUsage

from tools.geds.geds_functions import extract_geds_profiles
from tools.tools import call_tools, load_tools, invoke_corporate_function, get_functions_by_type
from utils.manage_message import load_messages
from utils.models import (Citation,
                                  Completion, Context, Message, MessageRequest,
                                  ToolInfo)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

__all__ = ["chat_with_data", "convert_chat_with_data_response", "build_completion_response"]

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2024-05-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

# versions capabilities
# https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
# client_data = AzureOpenAI(
#     # if we just use the azure_endpoint here it doesn't reach the extensions endpoint
#     # and thus we cannot use data sources directly
#     base_url=f'{azure_openai_uri}openai/deployments/{model}/extensions',
#     api_version=api_version,
#     #azure_endpoint=azure_openai_uri,
#     api_key=api_key
# )

# https://learn.microsoft.com/en-us/azure/ai-services/openai/references/on-your-data?tabs=python
# versions capabilities
# https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
# example of using functions with azure search instead of the data source
#   https://github.com/Azure-Samples/openai/blob/main/Basic_Samples/Functions/functions_with_azure_search.ipynb

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=str(azure_openai_uri),
    azure_ad_token_provider=token_provider,
)

def _create_azure_cognitive_search_data_source(index_name: str, top: int=3) -> dict:
    return {"data_sources":
            [{
            "type": "azure_search",
            "parameters": {
                "endpoint": service_endpoint,
                "index_name": index_name,
                "in_scope": True,
                "top_n_documents": top,
                "semantic_configuration": "default",
                "query_type": "vector_simple_hybrid",
                "fields_mapping": {},
                "authentication": {
                    "type": "api_key",
                    "key": key,
                },
                "embedding_dependency": {
                    "type": "deployment_name",
                    "deployment_name": "text-embedding-ada-002"
                },
            }
        }
    ]}


def chat_with_data(message_request: MessageRequest, stream=False) -> Tuple[Optional['ToolInfo'], Union['ChatCompletion', 'Stream[ChatCompletionChunk]']]:
    """
    Initiate a chat with via openai api using data_source (azure cognitive search)

    Documentation on this method:
        - https://github.com/openai/openai-cookbook/blob/main/examples/azure/chat_with_your_own_data.ipynb
        - https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
    """
    model = message_request.model
    messages = load_messages(message_request)
    # 1. Check if we are to use tools
    tools_info = None

    if message_request.tools:
        logger.debug("Using Tools: %s", message_request.tools)
        tools = load_tools(message_request.tools)
        # 1a. Invoke tools completion,
        additional_tools_required = True
        tools_used = False

        while additional_tools_required:
            completion_tools = client.chat.completions.create(
                    messages=messages,
                    model=model,
                    tools=tools, # type: ignore
                    tool_choice='auto',
                    stream=False
                ) # type: ignore

            if completion_tools.choices[0].message.tool_calls:
                tools_used = True
                if any(f.function.name in get_functions_by_type('corporate') for f in completion_tools.choices[0].message.tool_calls): # pylint: disable=line-too-long
                    logger.debug("This corporate function was passed -> %s", message_request.corporateFunction)
                    if message_request.corporateFunction in [f.function.name for f in completion_tools.choices[0].message.tool_calls]: # pylint: disable=line-too-long
                        # This will always end the while loop if a intranet question is detected, since the Azure OpenAI
                        # call for this currently holds the citations
                        # and we do not wish to maintain this part at this time.
                        # solution would be to retain citation and quote from answer and figure a way to retain them
                        # if the text match (not citations as part of msg extra content)
                        #      but the actual citations within the returned text, ex; The president is John Wayne[1]
                        # and you can contact him at 888-888-8888[2]
                        tools_info = ToolInfo()
                        tools_info.tool_type.append("corporate")
                        tools_info.function_names.append(message_request.corporateFunction)

                        index_name = invoke_corporate_function(message_request.corporateFunction)
                        logger.debug("Invoking index named --> %s", index_name)
                        return (tools_info, client.chat.completions.create(
                            messages=messages,
                            model=model,
                            extra_body=_create_azure_cognitive_search_data_source(index_name, message_request.top),
                            stream=stream
                        ))

                messages = call_tools(completion_tools.choices[0].message.tool_calls, messages)

            else:
                additional_tools_required = False

        # add tool info for tools used
        if tools_used:
            tools_info = add_tool_info_if_used(messages, tools)

    return (tools_info, client.chat.completions.create(
        messages=messages,
        model=model,
        stream=stream
    ))

def add_tool_info_if_used(messages: List[ChatCompletionMessageParam], tools: List[Any]) -> ToolInfo:
    tools_info = ToolInfo()
    function_to_tool_type = {tool['function']['name']: tool['tool_type'] for tool in tools if tool.get('type') == 'function'}

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
                    tools_info.payload = {"profiles": profiles}

            if function_name == "get_available_rooms":
                content = message.get("content", "")
                if content is not None:
                    try:
                        data = json.loads(content)
                    except json.JSONDecodeError:
                        logger.warning(f"Content is not valid JSON: {content}")
                        data = {}
                    if data.get("floorPlan") is not None:
                        floor_plan = data.get("floorPlan")
                        logger.debug(f"FLOOR PLAN: {floor_plan}")
                        tools_info.payload = {"floorPlan": floor_plan}

            if function_name == "verify_booking_details":
                content = message.get("content", "")
                if content is not None:
                    booking_details = json.loads(content)
                    logger.debug(f"BOOKING DETAILS {booking_details}")
                    tools_info.payload = {"bookingDetails": booking_details}

    return tools_info



def convert_chat_with_data_response(chat_completion: ChatCompletion) -> Completion:
    """
    Converts the OpenAI ChatCompletion response to a custom response (Completion)
    """
    chat_completion_dict = chat_completion.choices[0].message.model_dump()

    if isinstance(chat_completion.usage, CompletionUsage) and chat_completion.usage is not None:
        return build_completion_response(content=str(chat_completion.choices[0].message.content),
                                     chat_completion_dict=chat_completion_dict,
                                     role=chat_completion.choices[0].message.role,
                                     completion_tokens=chat_completion.usage.completion_tokens,
                                     prompt_tokens=chat_completion.usage.prompt_tokens,
                                     total_tokens=chat_completion.usage.total_tokens)
    else:
        return build_completion_response(content=str(chat_completion.choices[0].message.content),
                                     chat_completion_dict=chat_completion_dict,
                                     role=chat_completion.choices[0].message.role)

def build_completion_response(content: str,
                              chat_completion_dict: dict[str, Any] | None,
                              role: str = 'assistant',
                              completion_tokens: int = 0,
                              prompt_tokens: int = 0,
                              total_tokens: int = 0,
                              tools_info: Optional[ToolInfo] = None):
    """
    Builds a completion response based on the context given and the content
    """
    context = None
    if chat_completion_dict and 'context' in chat_completion_dict:
        context_dict = chat_completion_dict['context']
        citations: List[Citation] = [Citation(
            content=cit['content'],
            url=cit['url'],
            title=cit['title']
        ) for cit in context_dict['citations']]

        context = Context(role=role, citations=citations, intent=[json.loads(context_dict['intent'])])

    message = Message(
        role=role,
        content=content,
        context=context,
        tools_info=tools_info
    )

    return Completion(completion_tokens=completion_tokens,
                      prompt_tokens=prompt_tokens,
                      total_tokens=total_tokens,
                      message=message)
