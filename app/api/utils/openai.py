import os
from typing import List, Union
from openai import AzureOpenAI, Stream
from dataclasses import dataclass, field
from enum import Enum
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam, ChatCompletionChunk
import json

__all__ = ["chat_with_data"]

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-07-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
index_name: str         = os.getenv("AZURE_SEARCH_INDEX_NAME", "latest")
model: str              = os.getenv("AZURE_OPENAI_MODEL", "gpt-4-1106")

client = AzureOpenAI(
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

def chat_with_data(messages: List[ChatCompletionMessageParam]) -> ChatCompletion:
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
                "type": "AzureCognitiveSearch",
                "parameters": {
                    "endpoint": data_source.parameters.endpoint,
                    "key": data_source.parameters.key,
                    "indexName": data_source.parameters.indexName,
                }
            }
        ],
      },
      stream=False
  )

# openai.api_type = "azure"
# # Azure OpenAI on your own data is only supported by the 2023-08-01-preview API version
# openai.api_version = "2023-08-01-preview"

# # Azure OpenAI setup
# openai.api_base = "https://scsc-cio-ect-openai-oai.openai.azure.com/" # Add your endpoint here
# openai.api_key = os.getenv("OPENAI_API_KEY") # Add your OpenAI API key here
# deployment_id = "gpt-4-1106" # Add your deployment ID here

# # Azure AI Search setup
# search_endpoint = "https://ssc-assistant-search-service.search.windows.net"; # Add your Azure AI Search endpoint here
# search_key = os.getenv("SEARCH_KEY"); # Add your Azure AI Search admin key here
# search_index_name = "latest"; # Add your Azure AI Search index name here

# def setup_byod(deployment_id: str) -> None:
#     """Sets up the OpenAI Python SDK to use your own data for the chat endpoint.

#     :param deployment_id: The deployment ID for the model to use with your own data.

#     To remove this configuration, simply set openai.requestssession to None.
#     """

#     class BringYourOwnDataAdapter(requests.adapters.HTTPAdapter):

#         def send(self, request, **kwargs):
#             request.url = f"{openai.api_base}/openai/deployments/{deployment_id}/extensions/chat/completions?api-version={openai.api_version}"
#             return super().send(request, **kwargs)

#     session = requests.Session()

#     # Mount a custom adapter which will use the extensions endpoint for any call using the given `deployment_id`
#     session.mount(
#         prefix=f"{openai.api_base}/openai/deployments/{deployment_id}",
#         adapter=BringYourOwnDataAdapter()
#     )

#     openai.requestssession = session

# setup_byod(deployment_id)


# message_text = [{"role": "user", "content": "What are the differences between Azure Machine Learning and Azure AI services?"}]

# completion = openai.ChatCompletion.create(
#     messages=message_text,
#     deployment_id=deployment_id,
#     dataSources=[  # camelCase is intentional, as this is the format the API expects
#       {
#   "type": "AzureCognitiveSearch",
#   "parameters": {
#     "endpoint": "$search_endpoint",
#     "indexName": "$search_index",
#     "semanticConfiguration": null,
#     "queryType": "vectorSimpleHybrid",
#     "fieldsMapping": {
#       "contentFieldsSeparator": "\n",
#       "contentFields": [
#         "content"
#       ],
#       "filepathField": null,
#       "titleField": null,
#       "urlField": "url",
#       "vectorFields": [
#         "content_vector"
#       ]
#     },
#     "inScope": true,
#     "roleInformation": "You are an AI assistant that helps people find information.",
#     "filter": null,
#     "strictness": 3,
#     "topNDocuments": 5,
#     "key": "$search_key",
#     "embeddingDeploymentName": "text-embedding-ada-002"
#   }
# }
#     ],
#     enhancements=undefined,
#     temperature=0,
#     top_p=1,
#     max_tokens=800,
#     stop=null,
#     stream=true

# )
# print(completion)