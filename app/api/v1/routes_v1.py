import asyncio
import json
import logging

from apiflask import APIBlueprint
from flask import Response, jsonify, request, stream_with_context
from openai import Stream
from openai.types.chat import (ChatCompletion, ChatCompletionChunk)
from utils.db import store_conversation, leave_feedback
from utils.models import Completion, Feedback, MessageRequest
from utils.openai import (build_completion_response, chat_with_data,
                          convert_chat_with_data_response)
from utils.auth import auth
import uuid
import threading

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

api_v1 = APIBlueprint("api_v1", __name__)

_boundary = "GPT-Interaction"

@api_v1.post('/completion/chat')
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
@auth.login_required(role='chat')
def completion_myssc(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    completion: ChatCompletion = chat_with_data(message_request) # type: ignore
    completion_response = convert_chat_with_data_response(completion)
    #log to database
    convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
    thread = threading.Thread(target=store_conversation, args=(message_request, completion_response, convo_uuid))
    thread.start()

    return completion_response

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
def completion_myssc_stream(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    completion: ChatCompletion | Stream[ChatCompletionChunk] = chat_with_data(message_request, stream=True)

    if isinstance(completion, ChatCompletion):
        completion_response = convert_chat_with_data_response(completion)
        #log to database
        convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
        thread = threading.Thread(target=store_conversation, args=(message_request, completion_response, convo_uuid))
        thread.start()
        def generate_single_response():
            yield f'--{_boundary}\r\n'
            yield 'Content-Type: text/plain\r\n\r\n'
            yield str(completion.choices[0].message.content)
            yield f'\r\n--{_boundary}\r\n'
            yield 'Content-Type: application/json\r\n\r\n'
            yield json.dumps(
                completion_response.__dict__,
                default=lambda o: o.__dict__
            )
            yield f'\r\n--{_boundary}--\r\n'

        return Response(stream_with_context(generate_single_response()), content_type=f'multipart/x-mixed-replace; boundary={_boundary}')

    def generate():
        context = None
        content_txt = ''
        yield f'--{_boundary}\r\n'
        yield 'Content-Type: text/plain\r\n\r\n'
        for chunk in completion:
            if chunk.choices and chunk.choices[0].delta:
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
        #log to database
        convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
        thread = threading.Thread(target=store_conversation, args=(message_request, response, convo_uuid))
        thread.start()
        yield json.dumps(
             response.__dict__,
             default=lambda o: o.__dict__
        )
        yield f'\r\n--{_boundary}--\r\n'
    return Response(stream_with_context(generate()), content_type=f'multipart/x-mixed-replace; boundary={_boundary}')

@api_v1.post('/feedback')
@api_v1.doc("Send feedback to the team!")
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='feedback')
@api_v1.input(Feedback.Schema, arg_name="feedback", example={ # type: ignore
                                                                                "feedback": "this question has no real good answer in the system",
                                                                                "uuid": "010b9643-535a-4c45-b375-b45927150a27",
                                                                                "positive": 0
                                                                            })
def feedback(feedback: Feedback):
    convo_uuid = feedback.uuid if feedback.uuid else str(uuid.uuid4())
    leave_feedback(feedback, convo_uuid)
    return jsonify("Feedback saved!", 200)