import os
from typing import List, Union
from openai import AzureOpenAI, Stream
from dataclasses import dataclass, field
from enum import Enum
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam, ChatCompletionChunk
import json

from utils.models import Completion, Message, Citation, Metadata, ToolDataContent

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

class QueryType(Enum):
    VECTOR_SIMPLE_HYBRID = "vectorSimpleHybrid"

@dataclass
class AzureCognitiveSearchParameters:
    endpoint: str
    key: str
    indexName: str
    queryType: QueryType = QueryType.VECTOR_SIMPLE_HYBRID

@dataclass
class AzureCognitiveSearchDataSource:
    type: str = field(init=False, default="AzureCognitiveSearch")
    parameters: AzureCognitiveSearchParameters

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
    # Here we convert the pydantic model to a dictionary since the response it holds doesn't
    # follow their model (we have message and messages), thus we cannot access the fields otherwise
    #chat_completion_dict = chat_completion.model_dump()
    #print(chat_completion_dict)
    #unparsed_messages = chat_completion_dict['choices'][0]['messages']
    messages = []
    # if chat_completion.choices:
    #     for choice in chat_completion.choices:
    #         if choice.message.role == "tool":

    #             # Check if 'content' is a string that needs to be parsed as JSON  
    #             if isinstance(choice.message.content, str):  
    #                 # Parse the JSON-encoded string to get a list of dictionaries  
    #                 citations_list = json.loads(choice.message.content)  
    #             else:  
    #                 # If 'content' is already a list of dictionaries, use it directly  
    #                 citations_list = choice.message.content 
                
    #             # Create a list of Citation instances  
    #             citations = [Citation(content=cit['content'],  
    #                                 url=cit['url'],  
    #                                 metadata=Metadata(**cit['metadata']),  
    #                                 chunk_id=cit['chunk_id'],  
    #                                 title=cit['title'],  
    #                                 id=cit.get('id'),  # Using .get() for optional fields  
    #                                 filepath=cit.get('filepath')) for cit in citations_list]
    #             messages.append(ToolDataContent(citations=citations, intent=choice.intent))
    #         else:
    #             messages.append(Message(**msg))

    # return Completion(
    #     messages=messages,
    #     completion_tokens=chat_completion_dict['usage']['completion_tokens'],
    #     prompt_tokens=chat_completion_dict['usage']['prompt_tokens'],
    #     total_tokens=chat_completion_dict['usage']['total_tokens'],
    # )