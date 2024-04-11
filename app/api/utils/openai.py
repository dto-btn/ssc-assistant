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
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

from utils.tools import load_tools, call_tools

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

__all__ = ["chat_with_data", "convert_chat_with_data_response", "build_completion_response"]

#token_provider = get_bearer_token_provider(DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default")


azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2024-03-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
index_name: str         = os.getenv("AZURE_SEARCH_INDEX_NAME", "latest")
model: str              = os.getenv("AZURE_OPENAI_MODEL", "gpt-4-1106")
#model_data: str         = os.getenv("AZURE_OPENAI_MODEL_DATA", "gpt-4-32k")

# versions capabilities
# https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
# client_data = AzureOpenAI(
#     # if we just use the azure_endpoint here it doesn't reach the extensions endpoint and thus we cannot use data sources directly
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

def chat_with_data(message_request: MessageRequest, stream=False) -> Union[ChatCompletion,Stream[ChatCompletionChunk]]:
    """
    Initiate a chat with via openai api using data_source (azure cognitive search)

    Documentation on this method: 
        - https://github.com/openai/openai-cookbook/blob/main/examples/azure/chat_with_your_own_data.ipynb
        - https://learn.microsoft.com/en-us/azure/ai-services/openai/reference#completions-extensions
    """
    messages = load_messages(message_request)
    data_source = _create_azure_cognitive_search_data_source()
    data_sources = { #https://learn.microsoft.com/en-us/azure/ai-services/openai/references/azure-search?tabs=python
                "data_sources": [{
                    "type": data_source.type,
                    "parameters": {
                        "endpoint": data_source.parameters.endpoint,
                        "key": data_source.parameters.key,
                        "index_name": data_source.parameters.indexName,
                        "in_scope": True,
                        "top_n_documents": message_request.top,
                        "semantic_configuration": "default",
                        "query_type": "vector_simple_hybrid",
                        "fields_mapping": {},
                        "authentication": {
                            "type": "api_key",
                            "key": key
                        },
                        "embedding_dependency": {
                            "type": "deployment_name",
                            "deployment_name": "text-embedding-ada-002"
                        },
                    }
                }],
            }

    """
    1. Check if we are to use tools
    """
    corporate_question = False

    if message_request.tools:
        logger.debug(f"Using Tools: {message_request.tools}")
        tools = load_tools(message_request.tools)
        """
        1a. Invoke tools completion, 
        """
        completion_tools = client.chat.completions.create(
            messages=messages,
            model=model,
            tools=tools,
            stream=False
        )

        if completion_tools.choices[0].message.tool_calls:
            logger.debug(f"Tools were used in the request and OpenAI deemed it needed to invoke functions... gathering function data ...")
            logger.debug(f"tool_calls: {[f.function.name for f in completion_tools.choices[0].message.tool_calls]}")
            if "corporate_question" in [f.function.name for f in completion_tools.choices[0].message.tool_calls]:
                logger.debug("### DETECTED CORPORATE QUESTION ###")
                corporate_question = True
            messages = call_tools(completion_tools.choices[0].message.tool_calls, messages)
            logger.debug(messages[-1])

    if corporate_question:
        return client.chat.completions.create(
            messages=messages,
            model=model,
            extra_body=data_sources,
            stream=stream
        )
    else:
        return client.chat.completions.create(
            messages=messages,
            model=model,
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
        context=context
    )

    return Completion(completion_tokens=completion_tokens,
                      prompt_tokens=prompt_tokens,
                      total_tokens=total_tokens,
                      message=message)