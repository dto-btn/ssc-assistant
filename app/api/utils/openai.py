import json
import logging
import os
from typing import Any, List, Union

from openai import AzureOpenAI, Stream
from openai.types.chat import (ChatCompletion, ChatCompletionChunk,
                               ChatCompletionMessageParam)
from openai.types.completion_usage import CompletionUsage
from utils.manage_message import load_messages
from utils.models import (AzureCognitiveSearchDataSource,
                          AzureCognitiveSearchParameters, Citation, Completion,
                          Context, Message, MessageRequest, Metadata)

from utils.tools import load_tools, call_tools

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

__all__ = ["chat_with_data", "convert_chat_with_data_response", "build_completion_response", "chat"]

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-12-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
index_name: str         = os.getenv("AZURE_SEARCH_INDEX_NAME", "latest")
model: str              = os.getenv("AZURE_OPENAI_MODEL", "gpt-4-1106")
model_data: str         = os.getenv("AZURE_OPENAI_MODEL_DATA", "gpt-4-32k")

client_data = AzureOpenAI(
    # if we just use the azure_endpoint here it doesn't reach the extensions endpoint and thus we cannot use data sources directly
    base_url=f'{azure_openai_uri}openai/deployments/{model_data}/extensions',
    api_version=api_version,
    #azure_endpoint=azure_openai_uri,
    api_key=api_key
)

client = AzureOpenAI(
    api_version=api_version,
    azure_endpoint=str(azure_openai_uri),
    api_key=api_key
)

def _create_azure_cognitive_search_data_source() -> AzureCognitiveSearchDataSource:
    parameters = AzureCognitiveSearchParameters(
        endpoint=service_endpoint,
        key=key,
        indexName=index_name
    )
    return AzureCognitiveSearchDataSource(
        parameters=parameters
    )

def chat(message_request: MessageRequest, stream=False) -> Union[ChatCompletion,Stream[ChatCompletionChunk]]:
    """
    Chat with gpt directly without data, but perhaps with tools.
    """
    response_messages = _check_tools(message_request)

    # Create completion
    return client.chat.completions.create(
        messages=response_messages,
        model=model_data, # NOTICE: using this model for now as this is QUITE faster!
        stream=stream
    )

def _check_tools(message_request: MessageRequest) -> List[ChatCompletionMessageParam]:
    messages = load_messages(message_request)
    response_messages = messages
    # Check if tools are used and load them
    logger.info("Tools used: " + str(message_request.tools))
    if message_request.tools:
        tools = load_tools(message_request.tools)

        completion = client.chat.completions.create(
            messages=response_messages,
            model=model,
            tools=tools,
            stream=False
        )
        if completion.choices[0].message.content is not None:
            response_messages.append({"role": "assistant", "content": completion.choices[0].message.content})
        if completion.choices[0].message.tool_calls:
            response_messages = call_tools(completion.choices[0].message.tool_calls, messages)
    return response_messages

def chat_with_data(message_request: MessageRequest, stream=False) -> Union[ChatCompletion,Stream[ChatCompletionChunk]]:
    """
    Initiate a chat with via openai api using data_source (azure cognitive search)
    """
    data_source = _create_azure_cognitive_search_data_source()
    # https://github.com/openai/openai-cookbook/blob/main/examples/azure/chat_with_your_own_data.ipynb
    #https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
    return client_data.chat.completions.create(
        messages=load_messages(message_request),
        model=model_data,
        extra_body={
            "dataSources": [
                {
                    "type": data_source.type,
                    "parameters": {
                        "endpoint": data_source.parameters.endpoint,
                        "key": data_source.parameters.key,
                        "indexName": data_source.parameters.indexName,
                        "inScope": True,
                        "topNDocuments": message_request.top
                    }
                }
            ],
        },
        stream=stream
    )

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
                              total_tokens: int = 0):
    """
    Builds a completion response based on the context given and the content
    """
    context = None
    if chat_completion_dict and 'context' in chat_completion_dict:
        context_dict = chat_completion_dict['context']['messages'][0]
        # the content field is serialized json containing citations.
        content_dict = json.loads(context_dict['content'])

        citations: List[Citation] = [Citation(
            content=cit['content'],
            url=cit['url'],
            metadata=Metadata(chunking=cit['metadata']),
            title=cit['title']
        ) for cit in content_dict['citations']]

        context = Context(role=context_dict['role'], citations=citations, intent=json.loads(content_dict['intent']))

    message = Message(
        role=role,
        content=content,
        context=context
    )

    return Completion(completion_tokens=completion_tokens,
                      prompt_tokens=prompt_tokens,
                      total_tokens=total_tokens,
                      message=message)