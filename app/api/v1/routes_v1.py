import os
from typing import List
from flask import Blueprint, jsonify, Response, stream_with_context, request
from dotenv import load_dotenv
from azure.search.documents import SearchClient
from llama_index.llms import AzureOpenAI
from azure.core.credentials import AzureKeyCredential
from langchain_openai import AzureOpenAIEmbeddings
from llama_index import (ServiceContext,
                         StorageContext, VectorStoreIndex)
from llama_index.vector_stores.cogsearch import CognitiveSearchVectorStore
from llama_index.vector_stores.types import ExactMatchFilter, MetadataFilters
from llama_index.vector_stores.types import VectorStoreQueryMode
from llama_index.query_engine import RetrieverQueryEngine
from llama_index.core.response.schema import StreamingResponse
from llama_index import get_response_synthesizer
from models.message import Message, Node, Metadata
from llama_index.schema import NodeWithScore
import json

load_dotenv()
azure_openai_uri        = os.getenv("AZURE_OPENAI_ENDPOINT")
api_key                 = os.getenv("AZURE_OPENAI_API_KEY")
api_version             = os.getenv("AZURE_OPENAI_VERSION", "2023-07-01-preview")
service_endpoint        = os.getenv("AZURE_SEARCH_SERVICE_ENDPOINT", "INVALID")
key: str                = os.getenv("AZURE_SEARCH_ADMIN_KEY", "INVALID")
index_name: str         = os.getenv("AZURE_SEARCH_INDEX_NAME", "latest")

credential = AzureKeyCredential(key)
model: str = os.getenv("OPENAI_MODEL", "gpt-4-1106")
embedding_model: str = "text-embedding-ada-002"

api_v1 = Blueprint("api_v1", __name__)

@api_v1.route('/query', methods=["POST"])
def query():
    body = request.get_json(force=True)

    if "query" not in body:
        return jsonify({"error":"Request body must contain a query."}), 400
    else:
        query = body["query"]

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

    query_engine = RetrieverQueryEngine.from_args(
        retriever=retriever,
        service_context=service_context,
        response_synthesizer=response_synthesizer,
        verbose=True,
        streaming=True
    )

    #TODO: Handle message history ...

    @stream_with_context
    def generate():
        response_stream = query_engine.query(query)
        response_txt = ""
        for text in response_stream.response_gen:
            response_txt += text
            yield text
        source_nodes: List[NodeWithScore] = response_stream.source_nodes
        nodes = [
            Node(
                id_=n.node.id_,
                metadata=Metadata(**n.node.metadata),
                score=n.score,
                text=n.text
            ) for n in source_nodes
        ]
        message = Message(role="assistant", content=response_txt, nodes=nodes)
        yield json.dumps(message.__dict__, default=lambda o: o.__dict__)
    return Response(stream_with_context(generate()), content_type='application/x-json-stream')