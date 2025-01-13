import json
import logging
import threading
import uuid

import openai
import requests
from apiflask import APIBlueprint, abort
from flask import Response, jsonify, stream_with_context
from openai.types.chat import ChatCompletion

from tools.archibus.archibus_functions import make_api_call
from utils.auth import auth, user_ad
from utils.db import (flag_conversation, leave_feedback, save_file,
                              store_completion, store_request)
from utils.models import (BookingConfirmation, Completion, Feedback, FilePayload,
                                  MessageRequest)
from utils.openai import (build_completion_response, chat_with_data,
                                  convert_chat_with_data_response)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

api_v1 = APIBlueprint("api_v1", __name__)

_BOUNDARY = "GPT-Interaction"

@api_v1.post('/completion/chat')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={ # pylint: disable=no-member # type: ignore
                                                                                "messages": "",
                                                                                "query": "What is SSC's content management system?",
                                                                                "top": 3
                                                                            })
@api_v1.output(Completion.Schema, content_type='application/json', example={ # pylint: disable=no-member # type: ignore
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
@user_ad.login_required
def completion_chat(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    try:
        convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
        thread = threading.Thread(target=store_request, args=(message_request, convo_uuid))
        thread.start()

        completion: ChatCompletion = chat_with_data(message_request) # type: ignore
        completion_response = convert_chat_with_data_response(completion)
        user = user_ad.current_user()
        thread = threading.Thread(target=store_completion, args=(completion_response, convo_uuid, user))
        thread.start()

        return completion_response
    except openai.BadRequestError as e:
        if e.code == 'content_filter':
            # flag innapropriate
            flag_conversation(message_request, convo_uuid)
            logger.warning("Innaproriate question detected for convo id %s", convo_uuid)
        abort(400, message="OpenAI request error", extra_data=e.body) # type: ignore

@api_v1.post('/completion/chat/stream')
@api_v1.doc("send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content")
@api_v1.input(MessageRequest.Schema, arg_name="message_request", example={ # pylint: disable=no-member # type: ignore
                                                                "messages": "",
                                                                "query": "What is SSC's content management system?",
                                                                "top": 3
                                                            })
@api_v1.output(Completion.Schema, content_type=f'multipart/x-mixed-replace; boundary={_BOUNDARY}') # pylint: disable=no-member # type: ignore
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='chat')
@user_ad.login_required
def completion_chat_stream(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify({"error":"Request body must at least contain messages (conversation) or a query (direct question)."}), 400

    convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
    user = user_ad.current_user()
    thread = threading.Thread(target=store_request, args=(message_request, convo_uuid, user))
    thread.start()
    try:
        tools_info, completion = chat_with_data(message_request, stream=True)

        if isinstance(completion, ChatCompletion):
            completion_response = convert_chat_with_data_response(completion)
            thread = threading.Thread(target=store_completion, args=(completion_response, convo_uuid, user))
            thread.start()
            def generate_single_response():
                yield f'--{_BOUNDARY}\r\n'
                yield 'Content-Type: text/plain\r\n\r\n'
                yield str(completion.choices[0].message.content)
                yield f'\r\n--{_BOUNDARY}\r\n'
                yield 'Content-Type: application/json\r\n\r\n'
                yield json.dumps(
                    completion_response.__dict__,
                    default=lambda o: o.__dict__
                )
                yield f'\r\n--{_BOUNDARY}--\r\n'

            return Response(stream_with_context(generate_single_response()),
                content_type=f'multipart/x-mixed-replace; boundary={_BOUNDARY}')

        def generate():
            context = None
            content_txt = ''
            yield f'--{_BOUNDARY}\r\n'
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

            yield f'\r\n--{_BOUNDARY}\r\n'
            yield 'Content-Type: application/json\r\n\r\n'
            response = build_completion_response(content=content_txt,
                                                 chat_completion_dict=context,
                                                 tools_info=tools_info)
            thread = threading.Thread(target=store_completion, args=(response, convo_uuid, user))
            thread.start()
            yield json.dumps(
                response.__dict__,
                default=lambda o: o.__dict__
            )
            yield f'\r\n--{_BOUNDARY}--\r\n'
        return Response(stream_with_context(generate()),
                        content_type=f'multipart/x-mixed-replace; boundary={_BOUNDARY}')
    except openai.BadRequestError as e:
        if e.code == 'content_filter':
            # flag innapropriate
            flag_conversation(message_request, convo_uuid)
            logger.warning("Innaproriate question detected for convo id %s", convo_uuid)
        abort(400, message="OpenAI request error", extra_data=e.body) # type: ignore

@api_v1.post('/feedback')
@api_v1.doc("Send feedback to the team!")
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='feedback')
@api_v1.input(Feedback.Schema, arg_name="feedback_msg", example={ # pylint: disable=no-member # type: ignore
                                                    "feedback": "this question has no real good answer in the system",
                                                    "uuid": "010b9643-535a-4c45-b375-b45927150a27",
                                                    "positive": 0
                                                })
def feedback(feedback_msg: Feedback):
    """Send feedback to the team."""
    leave_feedback(feedback_msg)
    return jsonify("Feedback saved!", 200)

@api_v1.post('/book_reservation')
@api_v1.doc("Make a workspace booking through the Archibus API.")
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='chat')
@api_v1.input(BookingConfirmation.Schema, arg_name="booking_confirmation", example={ # pylint: disable=no-member # type: ignore
                                                                                    "buildingId": "HQ-BAS4",
                                                                                    "floorId": "T404",
                                                                                    "roomId": "W037",
                                                                                    "createdBy": "AITKEN, KYLE",
                                                                                    "assignedTo": "AITKEN, KYLE",
                                                                                    "bookingType": "FULLDAY",
                                                                                    "startDate": "2024-10-19"
                                                                                })
def book_reservation(booking_confirmation: BookingConfirmation):
    """Books a reservation using the Archibus API and returns the response."""
    try:
        uri = '/reservations/'

        # simple work around to uppercase the name (I think they fixed their API by now, this is code that will be removed anyways.)
        booking_confirmation.createdBy = booking_confirmation.createdBy.upper()
        booking_confirmation.assignedTo = booking_confirmation.assignedTo.upper()

        payload = json.dumps(
                    booking_confirmation.__dict__,
                    default=lambda o: o.__dict__
                )

        logger.debug(payload)
        response = make_api_call(uri, payload)
        return response.json()
    except requests.HTTPError as e:
        msg = f"Didn't make the reservation: {e}"
        logger.error(msg)
        abort(500, msg)

@api_v1.post('/upload')
@api_v1.doc("Upload a file that will be stored in the blob storage")
@api_v1.doc(security='ApiKeyAuth')
@auth.login_required(role='chat')
@api_v1.input(FilePayload.Schema, arg_name="file", location='json') # pylint: disable=no-member # type: ignore
def upload_file(file: FilePayload):
    """Allow users to uploaded encoded files and to decode and store them in Azure blob storage"""
    url = save_file(file)
    return jsonify({"message": "File received", "file_url": url}), 200