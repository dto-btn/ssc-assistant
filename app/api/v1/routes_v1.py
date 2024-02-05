import os
from typing import Any, List
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
from openai import Stream
from utils.models import Completion
from models.message import Message, Node, Metadata, MessageRequest
from llama_index.schema import NodeWithScore
import json
from utils.searchservice import get_query_engine, get_response_as_message
from utils.openai import chat_with_data, convert_chat_with_data_response, build_completion_response
from openai.types.chat import ChatCompletionUserMessageParam
import logging
from openai.types.chat import ChatCompletion, ChatCompletionMessageParam, ChatCompletionChunk

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

api_v1 = APIBlueprint("api_v1", __name__)

_boundary = "GPT-Interaction"

# @api_v1.post('/query/stream')
# @api_v1.doc("send a question to be processed by the gpt paired with search service, response will be streamed and multipart")
# @api_v1.input(MessageRequest.Schema, arg_name="message_request", example={
#                                                                                 "messages": "",
#                                                                                 "query": "What is SSC's content management system?",
#                                                                                 "top": 3
#                                                                             })
# @api_v1.output(Message.Schema, content_type=f'multipart/x-mixed-replace; boundary={_boundary}')
# def stream_query(message_request: MessageRequest):
#     if not message_request.query:
#         if not message_request.messages:
#             return jsonify({"error":"Request body must contain a query."}), 400
#         else:
#             query = "walruses"
#     else:
#         query = message_request.query

#     query_engine = get_query_engine(streaming=True)

#     @stream_with_context
#     def generate():
#         response_stream = query_engine.query(query)
#         response_txt = ""
#         yield f'--{_boundary}'
#         yield 'Content-Type: text/plain\r\n\r\n'
#         for text in response_stream.response_gen:
#             response_txt += text
#             yield text
#         yield f'\r\n--{_boundary}\r\n'  
#         yield 'Content-Type: application/json\r\n\r\n'
#         yield json.dumps(
#             get_response_as_message(response_txt, source_nodes=response_stream.source_nodes).__dict__, 
#             default=lambda o: o.__dict__
#         )
#         yield f'\r\n--{_boundary}--\r\n' 
#     return Response(stream_with_context(generate()), content_type='multipart/form-data')

@api_v1.post('/completion/myssc')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Completion.Schema, content_type='application/json', example={
    "completion_tokens": 241,
    "message": {
        "content": "The retrieved documents provide information on various services offered by Shared Services Canada (SSC). According to the documents, ....",
        "context": {
            "citations": [
                {
                    "content": "Service Catalogue Summary Catalogue of SSC services offered to partners and clients and how to order – available on SSC’s Serving Government website. URL http://service.ssc-spc.gc.ca/en/services VPN access required 1",
                    "metadata": {
                        "chunking": "{'chunking': 'orignal document size=53. Scores=7.680358Org Highlight count=8.'}"
                    },
                    "title": "Service Catalogue",
                    "url": "https://plus.ssc-spc.gc.ca/en/node/1296"
                }],
            "intent": [
                "services offered at SSC",
                "SSC services list",
                "what does SSC provide"
            ],
            "role": "tool"
        },
        "role": "assistant"
    },
    "prompt_tokens": 4962,
    "total_tokens": 5203
})
def completion_myssc(message_request: MessageRequest):
    if not message_request.query:
        if not message_request.messages:
            return jsonify({"error":"Request body must contain a query."}), 400
        else:
            query = "walruses"
    else:
        query = message_request.query

    completion: ChatCompletion = chat_with_data([ChatCompletionUserMessageParam(role="user", content=query)])

    message = completion.choices[0].message.model_dump()
    content_escaped_json = message['context']['messages'][0]['content']
    logging.debug(content_escaped_json)

    return convert_chat_with_data_response(completion)

@api_v1.post('/completion/myssc/stream')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Completion.Schema, content_type=f'multipart/x-mixed-replace; boundary={_boundary}')
def completion_myssc_stream(message_request: MessageRequest):
    if not message_request.query:
        if not message_request.messages:
            return jsonify({"error":"Request body must contain a query."}), 400
        else:
            query = "walruses"
    else:
        query = message_request.query

    completion: Stream[ChatCompletionChunk] = chat_with_data([ChatCompletionUserMessageParam(role="user", content=query)], stream=True)

    def generate():
        context = None
        content_txt = ''
        yield f'--{_boundary}\r\n'
        yield 'Content-Type: text/plain\r\n\r\n'
        for chunk in completion:
            delta = chunk.choices[0].delta
            delta_dict = chunk.choices[0].delta.model_dump()
            # we have to do this here because the `context` field is not mapped in the pydantic object
            # but is something custom that Azure OpenAI returns ..
            if 'context' in delta_dict:
                context = delta_dict

            if delta.content:
                content_txt += delta.content
                yield delta.content
        
        yield f'\r\n--{_boundary}\r\n'  
        yield 'Content-Type: application/json\r\n\r\n'
        response = build_completion_response(content=content_txt, chat_completion_dict=context)
        yield json.dumps(
             response.__dict__, 
             default=lambda o: o.__dict__
        )
        yield f'\r\n--{_boundary}--\r\n'
    return Response(stream_with_context(generate()), content_type='multipart/form-data')
