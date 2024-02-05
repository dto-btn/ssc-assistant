import os
from typing import List, Union
from openai import AzureOpenAI, Stream
from dataclasses import dataclass, field
from enum import Enum
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam, ChatCompletionChunk
from openai.types.completion_usage import CompletionUsage
import json

from utils.models import AzureCognitiveSearchDataSource, AzureCognitiveSearchParameters, Completion, Message, Citation, Context, Metadata

__all__ = ["chat_with_data", "convert_chat_with_data_response"]

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-12-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
index_name: str         = os.getenv("AZURE_SEARCH_INDEX_NAME", "latest")
model: str              = os.getenv("AZURE_OPENAI_MODEL", "gpt-4-1106")

client = AzureOpenAI(
    # if we just use the azure_endpoint here it doesn't reach the extensions endpoint and thus we cannot use data sources directly
    base_url=f'{azure_openai_uri}/openai/deployments/{model}/extensions',
    api_version=api_version,
    #azure_endpoint=azure_openai_uri,
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

def chat_with_data(messages: List[ChatCompletionMessageParam], stream=False) -> Union[ChatCompletion,Stream[ChatCompletionChunk]]:
    """
    Initiate a chat with via openai api using data_source (azure cognitive search)
    """
    data_source = _create_azure_cognitive_search_data_source()

    # https://github.com/openai/openai-cookbook/blob/main/examples/azure/chat_with_your_own_data.ipynb
    return client.chat.completions.create(
        messages=messages,
        model=model,
        extra_body={
            "dataSources": [
                {
                    "type": data_source.type,
                    "parameters": {
                        "endpoint": data_source.parameters.endpoint,
                        "key": data_source.parameters.key,
                        "indexName": data_source.parameters.indexName,
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
    context = None
    if 'context' in chat_completion_dict:
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
        role=chat_completion.choices[0].message.role,
        content=chat_completion.choices[0].message.content,
        context=context
    )

    if isinstance(chat_completion.usage, CompletionUsage) and chat_completion.usage is not None:
        return Completion(completion_tokens=chat_completion.usage.completion_tokens,
                      prompt_tokens=chat_completion.usage.prompt_tokens,
                      total_tokens=chat_completion.usage.total_tokens,
                      message=message)

    return Completion(message=message)