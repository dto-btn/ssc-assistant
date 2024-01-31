import os
from typing import List
from flask import jsonify, Response, stream_with_context, request
from apiflask import APIBlueprint
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
from models.message import Message, Node, Metadata, MessageRequest
from llama_index.schema import NodeWithScore
import json
from utils.searchservice import get_query_engine, get_response_as_message
import logging

logger = logging.getLogger(__name__)

api_v1 = APIBlueprint("api_v1", __name__)

_boundary = "GPT-Interaction"

@api_v1.post('/query/stream')
@api_v1.doc("send a question to be processed by the gpt paired with search service, response will be streamed and multipart")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Message.Schema, content_type=f'multipart/x-mixed-replace; boundary={_boundary}')
def stream_query(message_request: MessageRequest):
    if not message_request.query:
        if not message_request.messages:
            return jsonify({"error":"Request body must contain a query."}), 400
        else:
            query = "walruses"
    else:
        query = message_request.query

    query_engine = get_query_engine(streaming=True)

    @stream_with_context
    def generate():
        response_stream = query_engine.query(query)
        response_txt = ""
        yield f'--{_boundary}'
        yield 'Content-Type: text/plain\r\n\r\n'
        for text in response_stream.response_gen:
            response_txt += text
            yield text
        yield f'\r\n--{_boundary}\r\n'  
        yield 'Content-Type: application/json\r\n\r\n'
        yield json.dumps(
            get_response_as_message(response_txt, source_nodes=response_stream.source_nodes).__dict__, 
            default=lambda o: o.__dict__
        )
        yield f'\r\n--{_boundary}--\r\n' 
    return Response(stream_with_context(generate()), content_type='multipart/form-data')

@api_v1.post('/query')
@api_v1.doc("send a question to be processed by the gpt paired with search service")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Message.Schema, content_type='application/json', example={
    "content": "Shared Services Canada (SSC) offers a range of services that include ..",
    "nodes": [
        {
            "id_": "b09191cc-82d0-4b20-8483-b0c186321c83",
            "metadata": {
                "date": "2023-09-18",
                "filename": "preload/2024-01-29/structured_page/en/2477.json",
                "langcode": "en",
                "nid": "2477",
                "title": "Find answers to frequently asked questions",
                "url": "https://plus.ssc-spc.gc.ca/en/page/find-answers-frequently-asked-questions"
            },
            "score": 0.03181818127632141,
            "text": "Blah ..."
        },
    ],
    "role": "assistant"
})
def query(message_request: MessageRequest):
    if not message_request.query:
        if not message_request.messages:
            return jsonify({"error":"Request body must contain a query."}), 400
        else:
            query = "walruses"
    else:
        query = message_request.query

    query_engine = get_query_engine(streaming=False)
    response = query_engine.query(query)
    logger.debug(response)
    return jsonify(get_response_as_message(response.response_txt, source_nodes=response.source_nodes))

