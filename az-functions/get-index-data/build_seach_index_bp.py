from datetime import datetime
import logging
import json  # bourne
import os
import azure.functions as func
import azure.durable_functions as df


# from azure.core.credentials import AzureKeyCredential
# from azure.search.documents.indexes import SearchIndexClient
from azure.storage.blob import BlobServiceClient
from bs4 import BeautifulSoup
from dotenv import load_dotenv
# from langchain.embeddings.azure_openai import AzureOpenAIEmbeddings
# from llama_index import (Document, ServiceContext,
#                          StorageContext, VectorStoreIndex)
# from llama_index.llms.azure_openai import AzureOpenAI
# from llama_index.vector_stores.cogsearch import (CognitiveSearchVectorStore,
#                                                  IndexManagement)
from get_download_stats import get_latest_date

import sys
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from azure.search.documents.indexes import SearchIndexClient
from llama_index.core import (
    SimpleDirectoryReader,
    StorageContext,
    VectorStoreIndex,
)
from llama_index.core.settings import Settings

from llama_index.llms.azure_openai import AzureOpenAI
from llama_index.embeddings.azure_openai import AzureOpenAIEmbedding
from llama_index.vector_stores.azureaisearch import AzureAISearchVectorStore
from llama_index.vector_stores.azureaisearch import (
    IndexManagement,
    MetadataIndexFieldType,
)
from llama_index.core import Document


build_index_bp = df.Blueprint()
# https://github.com/Azure/azure-functions-durable-python/blob/dev/samples-v2/blueprint/durable_blueprints.py


# Configure environment variables
load_dotenv()
azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-07-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
blob_connection_string  = os.getenv("BLOB_CONNECTION_STRING")
container_name          = os.getenv("BLOB_CONTAINER_NAME")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")

credential = AzureKeyCredential(key)
model: str = os.getenv("OPENAI_MODEL", "gpt-4-1106")
embedding_model: str = "text-embedding-ada-002"

@build_index_bp.orchestration_trigger(context_name="context")
def build_search_index(context: df.DurableOrchestrationContext):
    logging.info('Python HTTP trigger function processed a request.')

    blob_service_client = BlobServiceClient.from_connection_string(str(blob_connection_string))
    container_name = 'sscplus-index-data'
    container_client = blob_service_client.get_container_client(container_name)

    index_client = SearchIndexClient(
        endpoint=service_endpoint,
        credential=credential,
    )

    metadata_fields = { "title" : "title",
                    "langcode" : "langcode",
                    "nid" : "nid",
                    "date" : "date",
                    "type" : "type",
                    "url" : "url",
                }
    
    index_name = get_latest_date(container_client=container_client)
    pages_path = f"{index_name}/pages"

    # vector_store = CognitiveSearchVectorStore(
    #         search_or_index_client=index_client,
    #         index_name=index_name,
    #         filterable_metadata_field_keys=metadata_fields,
    #         index_management=IndexManagement.CREATE_IF_NOT_EXISTS,
    #         id_field_key="id",
    #         chunk_field_key="content",
    #         embedding_field_key="content_vector",
    #         metadata_string_field_key="metadata",
    #         doc_id_field_key="doc_id",
    #     )
    
    vector_store = AzureAISearchVectorStore(
        search_or_index_client=index_client,
        filterable_metadata_field_keys=metadata_fields,
        index_name=index_name,
        index_management=IndexManagement.CREATE_IF_NOT_EXISTS,
        id_field_key="id",
        chunk_field_key="content",
        embedding_field_key="content_vector",
        embedding_dimensionality=1536,
        metadata_string_field_key="metadata",
        doc_id_field_key="doc_id",
    )

    pages = yield context.call_activity("get_pages_as_json", (pages_path, container_client))
    documents = []
    for page in pages:
        # https://gpt-index.readthedocs.io/en/v0.6.34/how_to/customization/custom_documents.html
        document = Document(
            text=str(page["body"]).replace("\n", " "),
            metadata={ # type: ignore
                'filename': page["filename"],
                'url': page["url"],
                'title': page["title"],
                'date': page["date"],
                'nid': page['nid'],
                'langcode': page['langcode']
            }
        )
        documents.append(document)

    llm = AzureOpenAI(
            model="gpt-35-turbo",
            azure_deployment=model,
            api_version=api_version,
            azure_endpoint=azure_openai_uri,
            api_key=api_key
        )

    embed_model = AzureOpenAIEmbedding(
        model=embedding_model, 
        api_key=api_key, 
        azure_endpoint=azure_openai_uri
        )

    storage_context = StorageContext.from_defaults(vector_store=vector_store)

    Settings.llm = llm
    Settings.embed_model = embed_model
    index = VectorStoreIndex.from_documents(
        documents, storage_context=storage_context
    )

    # storage_context = StorageContext.from_defaults(vector_store=vector_store)
    # service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed_model)

    # index = VectorStoreIndex.from_documents(
    #     documents, storage_context=storage_context, service_context=service_context
    # )

    return func.HttpResponse(f"Index created: {index_name}.")


# Activity
@build_index_bp.activity_trigger(input_name="params")
def get_pages_as_json(params: tuple):
    pages = []
    container_client = params[1]
    blob_list = container_client.list_blobs(name_starts_with=params[0])

    ignore_selectors = ['div.comment-login-message', 'section.block-date-modified-block']

    for blob in blob_list:
        blob_client = container_client.get_blob_client(blob) # type: ignore
        # Download the blob data and decode it to string
        data = blob_client.download_blob().readall().decode('utf-8')
        if data is not None:
            raw = json.loads(data)
            if isinstance(raw, list) and raw:
                raw = raw[0] # sometimes the object is boxed into an array, not useful to us
            if isinstance(raw, dict):
                page = {}
                soup = BeautifulSoup(raw["body"], "html.parser")
                # remove useless tags like date modified and login blocks (see example in 336 parsed data vs non parsed)
                for selector in ignore_selectors:
                     for s in soup.select(selector):
                         s.decompose()

                page["body"] = ' '.join(soup.stripped_strings)
                page["title"] = str(raw["title"]).strip()
                page["url"] = str(raw["url"]).strip()
                page["date"] = str(raw["date"]).strip()
                page["filename"] = blob_client.blob_name
                page["nid"] = str(raw['nid']).strip()
                page["langcode"] = str(raw['langcode']).strip()

                pages.append(page)
    return pages