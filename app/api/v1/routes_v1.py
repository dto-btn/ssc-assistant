import json
import logging
import os

from apiflask import APIBlueprint
from flask import Response, jsonify, request, stream_with_context
from openai import Stream
from openai.types.chat import (ChatCompletion, ChatCompletionChunk, ChatCompletionMessageParam)
from utils.models import Completion, MessageRequest
from utils.openai import (build_completion_response, chat, chat_with_data,
                          convert_chat_with_data_response, num_tokens_from_messages, num_tokens_from_string)
from utils.manage_message import load_messages
from utils.auth import auth

model: str              = os.getenv("AZURE_OPENAI_MODEL", "gpt-4-1106")

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

api_v1 = APIBlueprint("api_v1", __name__)

_boundary = "GPT-Interaction"

@api_v1.post('/completion/myssc')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={ # type: ignore
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Completion.Schema, content_type='application/json', example={ # type: ignore
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
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='myssc')
def completion_myssc(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    completion: ChatCompletion = chat_with_data(message_request) # type: ignore

    message = completion.choices[0].message.model_dump()
    content_escaped_json = message['context']['messages'][0]['content']
    logging.debug(content_escaped_json)

    return convert_chat_with_data_response(completion)

@api_v1.post('/completion/myssc/stream')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={ # type: ignore
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Completion.Schema, content_type=f'multipart/x-mixed-replace; boundary={_boundary}') # type: ignore
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='myssc')
def completion_myssc_stream(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    messages = load_messages(message_request)
    prompt_tokens = num_tokens_from_messages(messages, model=model)
    completion: Stream[ChatCompletionChunk] = chat_with_data(message_request, stream=True) # type: ignore

    def generate():
        context = None
        content_txt = ''
        completion_tokens = 0
        yield f'--{_boundary}\r\n'
        yield 'Content-Type: text/plain\r\n\r\n'
        for chunk in completion:
            delta = chunk.choices[0].delta
            delta_dict = chunk.choices[0].delta.model_dump()
            # we have to do this here because the `context` field is not mapped in the pydantic object
            # but is something custom that Azure OpenAI returns ..
            if 'context' in delta_dict:
                context = delta_dict
                # completion_tokens += num_tokens_from_string(context, model=model)  

            if delta.content:
                content_txt += delta.content
                completion_tokens += num_tokens_from_string(delta.content, model=model)
                yield delta.content

        yield f'\r\n--{_boundary}\r\n'
        yield 'Content-Type: application/json\r\n\r\n'
        response = build_completion_response(content=content_txt, chat_completion_dict=context, prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=completion_tokens + prompt_tokens)
        yield json.dumps(
             response.__dict__,
             default=lambda o: o.__dict__
        )
        yield f'\r\n--{_boundary}--\r\n'
    return Response(stream_with_context(generate()), content_type=f'multipart/x-mixed-replace; boundary={_boundary}')


@api_v1.post('/completion/chat')
@api_v1.doc("Send a generic question to GPT, might be using tools")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={ # type: ignore
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "tools": ["geds", "bits"]
                                                                            })
@api_v1.output(Completion.Schema, content_type='application/json', example={ # type: ignore
    "completion_tokens": 241,
    "message": {
        "content": "Contact information for employe XYZ is as follow: ...",
        "role": "assistant"
    },
    "prompt_tokens": 4962,
    "total_tokens": 5203
})
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='chat')
def completion_chat(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    completion: ChatCompletion = chat(message_request) # type: ignore

    return convert_chat_with_data_response(completion)

@api_v1.post('/completion/chat/stream')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={ # type: ignore
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Completion.Schema, content_type=f'multipart/x-mixed-replace; boundary={_boundary}') # type: ignore
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='chat')
def completion_chat_stream(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    messages = load_messages(message_request)
    prompt_tokens = num_tokens_from_messages(messages, model=model)
    toolsUsed = message_request.tools
    completion: Stream[ChatCompletionChunk] = chat(message_request, stream=True) # type: ignore

    def generate():
        content_txt = ''
        completion_tokens = 0
        yield f'--{_boundary}\r\n'
        yield 'Content-Type: text/plain\r\n\r\n'
        for chunk in completion:
            if chunk.choices and chunk.choices[0].delta:
                delta = chunk.choices[0].delta
                if delta.content:
                    content_txt += str(delta.content)
                    completion_tokens += num_tokens_from_string(str(delta.content), model=model)
                    yield delta.content

        yield f'\r\n--{_boundary}\r\n'
        yield 'Content-Type: application/json\r\n\r\n'
        response = build_completion_response(content=content_txt, chat_completion_dict=None, prompt_tokens=prompt_tokens, completion_tokens=completion_tokens, total_tokens=completion_tokens + prompt_tokens)
        yield json.dumps(
             response.__dict__,
             default=lambda o: o.__dict__
        )
        yield f'\r\n--{_boundary}--\r\n'
    return Response(stream_with_context(generate()), content_type=f'multipart/x-mixed-replace; boundary={_boundary}')