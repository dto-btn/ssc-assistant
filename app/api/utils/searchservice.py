import os
from typing import List
from azure.core.credentials import AzureKeyCredential
from azure.search.documents import SearchClient
from dotenv import load_dotenv
from langchain_openai import AzureOpenAIEmbeddings
from llama_index import (ServiceContext, StorageContext, VectorStoreIndex,
                         get_response_synthesizer)
from llama_index.llms import AzureOpenAI
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.vector_stores.cogsearch import CognitiveSearchVectorStore
from llama_index.vector_stores.types import (VectorStoreQueryMode)
from models.message import Message, Node, Metadata
from llama_index.schema import NodeWithScore

azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-07-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
index_name: str         = os.getenv("AZURE_SEARCH_INDEX_NAME", "latest")
model: str              = os.getenv("AZURE_OPENAI_MODEL", "gpt-4-1106")

credential = AzureKeyCredential(key)

embedding_model: str = "text-embedding-ada-002"

def get_query_engine(streaming: bool) -> RetrieverQueryEngine:
    """
    Returns a query engine that leverage the Azure Search Services and a specific index.
    """
    search_client = SearchClient(
        endpoint=service_endpoint,
        index_name=index_name,
        credential=credential,
    )

    vector_store = CognitiveSearchVectorStore(
            search_or_index_client=search_client,
            id_field_key="id",
            chunk_field_key="content",
            embedding_field_key="content_vector",
            metadata_string_field_key="metadata",
            doc_id_field_key="doc_id",)

    llm = AzureOpenAI(
        model="gpt-4",
        azure_deployment=model,
        api_version=api_version,
        azure_endpoint=azure_openai_uri,
        api_key=api_key
    )

    embed_model = AzureOpenAIEmbeddings(
        model=embedding_model, api_key=api_key, azure_endpoint=azure_openai_uri)

    storage_context = StorageContext.from_defaults(vector_store=vector_store)
    service_context = ServiceContext.from_defaults(llm=llm, embed_model=embed_model)

    index = VectorStoreIndex.from_documents(
        [], storage_context=storage_context, service_context=service_context
    )

    #TODO: Find about the other methods and how to enable them (ex: VectorStoreQueryMode.SEMANTIC_HYBRID)
    retriever = index.as_retriever(
        vector_store_query_mode=VectorStoreQueryMode.HYBRID
    )

    response_synthesizer = get_response_synthesizer(streaming=True,service_context=service_context)

    return RetrieverQueryEngine.from_args(
        retriever=retriever,
        service_context=service_context,
        response_synthesizer=response_synthesizer,
        verbose=True,
        streaming=streaming
    )

def get_response_as_message(content: str, source_nodes: List[NodeWithScore]) -> Message:
    """
    Simply formats a response we get from llama_index libs to a simple Message format to return to the user
    """
    nodes = [
        Node(
            id_=n.node.id_,
            metadata=Metadata(**n.node.metadata),
            score=n.score,
            text=n.text
        ) for n in source_nodes
    ]
    return Message(role="assistant", content=content, nodes=nodes)