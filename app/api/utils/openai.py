import json
import logging
import os
from typing import Any, List, Optional, Tuple, Union

from azure.identity import DefaultAzureCredential, get_bearer_token_provider
from openai import AzureOpenAI, Stream
from openai.types.chat import ChatCompletion, ChatCompletionChunk
from openai.types.completion_usage import CompletionUsage
from utils.azure_openai_deployment_mapper import map_model_to_deployment
from tools.pmcoe.pmcoe_functions import PMCOE_CONTAINER
from src.constants.tools import TOOL_CORPORATE, TOOL_PMCOE, TOOL_TELECOM
from src.service.tool_service import ToolService
from utils.manage_message import load_messages
from utils.models import (Citation, Completion, Context, Message,
                          MessageRequest, ToolInfo, AzureCognitiveSearchDataSourceConfig)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

__all__ = ["chat_with_data", "convert_chat_with_data_response", "build_completion_response"]

token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2024-05-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=str(azure_openai_uri),
    azure_ad_token_provider=token_provider,
)

def _create_azure_cognitive_search_data_source(config: AzureCognitiveSearchDataSourceConfig) -> dict:
    current_filter=""
    if config.lang_filter == 'en' or config.lang_filter == 'fr':
        current_filter = f"langcode eq '{config.lang_filter}'"
        logger.debug("Adding langfilter to datasource query %s", current_filter)
    return {"data_sources":
        [{
            "type": "azure_search",
            "parameters": {
                "endpoint": service_endpoint,
                "index_name": config.index_name,
                "in_scope": True,
                "top_n_documents": config.top_n_documents,
                "semantic_configuration": "default",
                "query_type": config.query_type,
                "fields_mapping": {},
                "authentication": {
                    "type": "api_key",
                    "key": key,
                },
                "filter": current_filter,
                "embedding_dependency": {
                    "type": "deployment_name",
                    "deployment_name": config.embedding_model
                },
            }
        }]
    }


def chat_with_data(message_request: MessageRequest, stream=False) -> Tuple[Optional[List['ToolInfo']], Union['ChatCompletion', 'Stream[ChatCompletionChunk]']]:# pylint: disable=line-too-long
    """
    Initiate a chat with via openai api using data_source (azure cognitive search)

    Documentation on this method:
        - https://github.com/openai/openai-cookbook/blob/main/examples/azure/chat_with_your_own_data.ipynb
        - https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
    """
    model = message_request.model
    messages = load_messages(message_request)
    # 1. Check if we are to use tools
    tool_service = ToolService(message_request.tools if message_request.tools else [])
    if message_request.tools:
        logger.debug("Requested tools: %s", message_request.tools)

        # 1a. Invoke tools completion,
        additional_tools_required = True

        while additional_tools_required and tool_service.tools:
            completion_tools = client.chat.completions.create(
                    messages=messages,
                    model=map_model_to_deployment(model),
                    tools=tool_service.tools, # type: ignore
                    #https://platform.openai.com/docs/guides/function-calling#additional-configurations
                    tool_choice='auto',
                    stream=False
                ) # type: ignore

            if completion_tools.choices[0].message.tool_calls:
                if any(
                    (
                        f.function.name
                        in tool_service.get_functions_by_type(TOOL_CORPORATE)
                        or f.function.name
                        in tool_service.get_functions_by_type(TOOL_PMCOE)
                        or f.function.name
                        in tool_service.get_functions_by_type(TOOL_TELECOM)
                    )
                    for f in completion_tools.choices[0].message.tool_calls
                ):
                    tool_messages = tool_service.call_tools(completion_tools.choices[0].message.tool_calls, messages)
                    last_message = tool_messages[-1]
                    if isinstance(last_message, dict) and "content" in last_message:
                        # Parse the tool response into the AzureCognitiveSearchDataSourceConfig Pydantic model
                        try:
                            tool_response = json.loads(str(last_message['content']))
                            # Create the search config directly with language filter applied
                            search_config = AzureCognitiveSearchDataSourceConfig(
                                **tool_response,
                                lang_filter=message_request.lang if tool_response.get('use_language_filter', False) else ""
                            )
                            return (tool_service.tools_info, client.chat.completions.create(
                                messages=messages,
                                model=model,
                                extra_body=_create_azure_cognitive_search_data_source(search_config),
                                stream=stream
                            ))
                        except Exception as e:
                            logger.error("Failed to parse tool response into AzureCognitiveSearchDataSourceConfig: %s", e)

                # this will modify the messages array we send to OpenAI to contain the function_calls **it** requested
                # and that we processed on it's behalf.
                messages = tool_service.call_tools(completion_tools.choices[0].message.tool_calls, messages)
            else:
                additional_tools_required = False
    return (tool_service.tools_info, client.chat.completions.create(
        messages=messages,
        model=model,
        stream=stream
    ))

def convert_chat_with_data_response(chat_completion: ChatCompletion, lang: str = 'en') -> Completion:
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
                                     total_tokens=chat_completion.usage.total_tokens,
                                     lang=lang)
    else:
        return build_completion_response(content=str(chat_completion.choices[0].message.content),
                                     chat_completion_dict=chat_completion_dict,
                                     role=chat_completion.choices[0].message.role,
                                     lang=lang)

def build_completion_response(content: str,
                              chat_completion_dict: dict[str, Any] | None,
                              role: str = 'assistant',
                              completion_tokens: int = 0,
                              prompt_tokens: int = 0,
                              total_tokens: int = 0,
                              tools_info: Optional[List[ToolInfo]] = None,
                              lang: str = 'en'):
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

        # This is a hack to make sure PMCOE responses are cited correctly.
        # We currently don't get the URL of the original files for PMCOE index.
        # Because of this, we need to manually create the correct URL for PMCOE citations.
        # Luckily we have the filename, so it is a matter of prepending the correct URL.
        if tools_info and any(tool.tool_type == TOOL_PMCOE for tool in tools_info):
            for citation in citations:
                if not citation.url:
                    filename = citation.title
                    # Choose path based on user's language preference
                    if lang == 'en':
                        folder_path = f"/{PMCOE_CONTAINER}/en"
                    else:
                        folder_path = f"/{PMCOE_CONTAINER}/fr"
                    citation.url = f"{folder_path}/{filename}"

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
