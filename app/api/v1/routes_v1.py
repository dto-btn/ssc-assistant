import json
import logging
import re
import threading
from typing import List
import uuid
import os

import openai
import requests
from apiflask import APIBlueprint, abort
from flask import Response, jsonify, stream_with_context
from openai.types.chat import ChatCompletion

from src.service.suggestion_service import SuggestionService
from utils.manage_message import SUGGEST_SYSTEM_PROMPT_FR, SUGGEST_SYSTEM_PROMPT_EN
from src.context.build_context import build_context

from tools.archibus.archibus_functions import make_api_call
from utils.auth import auth, user_ad
from utils.db import (
    flag_conversation,
    leave_feedback,
    save_file,
    store_completion,
    store_request,
    store_suggestion,
)
from utils.models import (
    BookingConfirmation,
    Citation,
    Completion,
    Feedback,
    FilePayload,
    Message,
    MessageRequest,
    NewSuggestionResponse,
    SuggestionRequest,
    NewSuggestionRequest,
)
from utils.openai import (
    build_completion_response,
    chat_with_data,
    convert_chat_with_data_response,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

api_v1 = APIBlueprint("api_v1", __name__)

_BOUNDARY = "GPT-Interaction"


@api_v1.post("/completion/chat")
@api_v1.doc(
    "send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content"
)
@api_v1.input(
    MessageRequest.Schema,
    arg_name="message_request",
    example={  # pylint: disable=no-member # type: ignore
        "messages": "",
        "query": "What is SSC's content management system?",
        "top": 3,
    },
)
@api_v1.output(
    Completion.Schema,
    content_type="application/json",
    example={  # pylint: disable=no-member # type: ignore
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
                        "url": "https://plus.ssc-spc.gc.ca/en/node/1296",
                    }
                ],
                "intent": [
                    "services offered at SSC",
                    "SSC services list",
                    "what does SSC provide",
                ],
                "role": "tool",
            },
            "role": "assistant",
        },
        "prompt_tokens": 4962,
        "total_tokens": 5203,
    },
)
@api_v1.doc(security="ApiKeyAuth")
@auth.login_required(role="chat")
@user_ad.login_required
def completion_chat(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify(
            {
                "error": "Request body must at least contain messages (conversation) or a query (direct question)."
            }
        ), 400

    try:
        convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
        user = user_ad.current_user()
        thread = threading.Thread(
            target=store_request, args=(message_request, convo_uuid, user)
        )
        thread.start()

        completion: ChatCompletion = chat_with_data(message_request)  # type: ignore
        completion_response = convert_chat_with_data_response(completion)

        thread = threading.Thread(
            target=store_completion, args=(completion_response, convo_uuid, user)
        )
        thread.start()

        return completion_response
    except openai.BadRequestError as e:
        if e.code == "content_filter":
            # flag innapropriate
            flag_conversation(message_request, convo_uuid)
            logger.warning("Innaproriate question detected for convo id %s", convo_uuid)
        abort(400, message="OpenAI request error", extra_data=e.body)  # type: ignore


@api_v1.post("/completion/chat/stream")
@api_v1.doc(
    "send a question to be processed by the gpt paired with search service. Answer is accessibe via json choices[0].content"
)
@api_v1.input(
    MessageRequest.Schema,
    arg_name="message_request",
    example={  # pylint: disable=no-member # type: ignore
        "messages": "",
        "query": "What is SSC's content management system?",
        "top": 3,
    },
)
@api_v1.output(
    Completion.Schema, content_type=f"multipart/x-mixed-replace; boundary={_BOUNDARY}"
)  # pylint: disable=no-member # type: ignore
@api_v1.doc(security="ApiKeyAuth")
@auth.login_required(role="chat")
@user_ad.login_required
def completion_chat_stream(message_request: MessageRequest):
    if not message_request.query and not message_request.messages:
        return jsonify(
            {
                "error": "Request body must at least contain messages (conversation) or a query (direct question)."
            }
        ), 400

    convo_uuid = message_request.uuid if message_request.uuid else str(uuid.uuid4())
    user = user_ad.current_user()
    thread = threading.Thread(
        target=store_request, args=(message_request, convo_uuid, user)
    )
    thread.start()
    try:
        tools_info, completion = chat_with_data(message_request, stream=True)

        if isinstance(completion, ChatCompletion):
            completion_response = convert_chat_with_data_response(completion)
            thread = threading.Thread(
                target=store_completion, args=(completion_response, convo_uuid, user)
            )
            thread.start()

            def generate_single_response():
                yield f"--{_BOUNDARY}\r\n"
                yield "Content-Type: text/plain\r\n\r\n"
                yield str(completion.choices[0].message.content)
                yield f"\r\n--{_BOUNDARY}\r\n"
                yield "Content-Type: application/json\r\n\r\n"
                yield json.dumps(
                    completion_response.__dict__, default=lambda o: o.__dict__
                )
                yield f"\r\n--{_BOUNDARY}--\r\n"

            return Response(
                stream_with_context(generate_single_response()),
                content_type=f"multipart/x-mixed-replace; boundary={_BOUNDARY}",
            )

        def generate():
            context = None
            content_txt = ""
            yield f"--{_BOUNDARY}\r\n"
            yield "Content-Type: text/plain\r\n\r\n"
            for chunk in completion:
                if chunk.choices and chunk.choices[0].delta:
                    delta = chunk.choices[0].delta
                    delta_dict = chunk.choices[0].delta.model_dump()
                    # we have to do this here because the `context` field is not mapped in the pydantic object
                    # but is something custom that Azure OpenAI returns ..
                    if "context" in delta_dict:
                        context = delta_dict

                    if delta.content:
                        content_txt += delta.content
                        yield delta.content

            yield f"\r\n--{_BOUNDARY}\r\n"
            yield "Content-Type: application/json\r\n\r\n"
            response = build_completion_response(
                content=content_txt, chat_completion_dict=context, tools_info=tools_info
            )
            thread = threading.Thread(
                target=store_completion, args=(response, convo_uuid, user)
            )
            thread.start()
            yield json.dumps(response.__dict__, default=lambda o: o.__dict__)
            yield f"\r\n--{_BOUNDARY}--\r\n"

        return Response(
            stream_with_context(generate()),
            content_type=f"multipart/x-mixed-replace; boundary={_BOUNDARY}",
        )
    except openai.BadRequestError as e:
        if e.code == "content_filter":
            # flag innapropriate
            flag_conversation(message_request, convo_uuid)
            logger.warning("Innaproriate question detected for convo id %s", convo_uuid)
        abort(400, message="OpenAI request error", extra_data=e.body)  # type: ignore


@api_v1.post("/feedback")
@api_v1.doc("Send feedback to the team!")
@api_v1.doc(security="ApiKeyAuth")
@auth.login_required(role="feedback")
@api_v1.input(
    Feedback.Schema,
    arg_name="feedback_msg",
    example={  # pylint: disable=no-member # type: ignore
        "feedback": "this question has no real good answer in the system",
        "uuid": "010b9643-535a-4c45-b375-b45927150a27",
        "positive": 0,
    },
)
def feedback(feedback_msg: Feedback):
    """Send feedback to the team."""
    leave_feedback(feedback_msg)
    return jsonify("Feedback saved!", 200)


@api_v1.post("/book_reservation")
@api_v1.doc("Make a workspace booking through the Archibus API.")
@api_v1.doc(security="ApiKeyAuth")
@auth.login_required(role="chat")
@api_v1.input(
    BookingConfirmation.Schema,
    arg_name="booking_confirmation",
    example={  # pylint: disable=no-member # type: ignore
        "buildingId": "HQ-BAS4",
        "floorId": "T404",
        "roomId": "W037",
        "createdBy": "AITKEN, KYLE",
        "assignedTo": "AITKEN, KYLE",
        "bookingType": "FULLDAY",
        "startDate": "2024-10-19",
    },
)
def book_reservation(booking_confirmation: BookingConfirmation):
    """Books a reservation using the Archibus API and returns the response."""
    try:
        uri = "/reservations/"

        # simple work around to uppercase the name (I think they fixed their API by now, this is code that will be removed anyways.)
        booking_confirmation.createdBy = booking_confirmation.createdBy.upper()
        booking_confirmation.assignedTo = booking_confirmation.assignedTo.upper()

        payload = json.dumps(
            booking_confirmation.__dict__, default=lambda o: o.__dict__
        )

        logger.debug(payload)
        response = make_api_call(uri, payload)
        return response.json()
    except requests.HTTPError as e:
        msg = f"Didn't make the reservation: {e}"
        logger.error(msg)
        abort(500, msg)


@api_v1.post("/upload")
@api_v1.doc("Upload a file that will be stored in the blob storage")
@api_v1.doc(security="ApiKeyAuth")
@auth.login_required(role="chat")
@api_v1.input(FilePayload.Schema, arg_name="file", location="json")  # pylint: disable=no-member # type: ignore
def upload_file(file: FilePayload):
    """Allow users to uploaded encoded files and to decode and store them in Azure blob storage"""
    url = save_file(file)
    return jsonify({"message": "File received", "file_url": url}), 200

if os.getenv("FF_USE_NEW_SUGGESTION_SERVICE", "").strip().lower() == "true":

    @api_v1.post("/suggest")
    @api_v1.doc("""Send a search query that will do a RAG search within the proper index,
                and return a completion response along with citations (URLs) to MySSC+ content""")
    @api_v1.input(
        NewSuggestionRequest.Schema,  # pylint: disable=no-member # type: ignore
        arg_name="suggestion_request",
        example={
            "query": "What is SSC's content management system?",
            "opts": {
                "language": "en",
                "requester": "mysscplus",
                "system_prompt": "Only respond in pirate speak.",
            },
        },
    )
    @api_v1.output(
        NewSuggestionResponse.Schema,
        content_type="application/json",
        example={
            # This will be set to True for valid queries.
            "has_suggestions": True,
            # This will be either "en" or "fr", depending on the language of the suggestion.
            "language": "en",
            # This will be set to the query that was used to generate the suggestion.
            "original_query": "What is SSC's content management system?",
            # This will be set to the time the suggestion was generated.
            "timestamp": "2022-01-01T00:00:00.000Z",
            # This will be set to the application that requested the suggestion.
            "requester": "mysscplus",
            # This will be set to the body of the suggestion.
            "suggestion_body": "Arr, ye be askin' about the content management system at SSC. Here be what I found...",
            # This will be a list of citations for the suggestion.
            "suggestion_citations": [
                {
                    "url": "https://example.com",
                }
            ],
        },
    )
    @api_v1.doc(security="ApiKeyAuth")
    @auth.login_required(role="suggest")
    @user_ad.login_required
    def suggestion(suggestion_request: NewSuggestionRequest):
        """This will receive most likely search terms and will return an AI response along with citations"""
        suggestion_service = SuggestionService()
        response = suggestion_service.suggest(
            suggestion_request.query, suggestion_request.opts
        )
        return response
else:

    @api_v1.post("/suggest")
    @api_v1.doc("""Send a search query that will do a RAG search within the proper index,
                and return a completion response along with citations (URLs) to MySSC+ content""")
    @api_v1.input(
        SuggestionRequest.Schema,  # pylint: disable=no-member # type: ignore
        arg_name="suggestion_request",
        example={
            "query": "What is SSC's content management system?",
            "lang": "en",
            "dedupe_citations": True,
            "remove_markdown": True,
        },
    )
    @api_v1.output(
        Completion.Schema,
        content_type="application/json",
        example={  # pylint: disable=no-member # type: ignore
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
                            "url": "https://plus.ssc-spc.gc.ca/en/node/1296",
                        }
                    ],
                    "intent": [
                        "services offered at SSC",
                        "SSC services list",
                        "what does SSC provide",
                    ],
                    "role": "tool",
                },
                "role": "assistant",
            },
            "prompt_tokens": 4962,
            "total_tokens": 5203,
        },
    )
    @api_v1.doc(security="ApiKeyAuth")
    @auth.login_required(role="suggest")
    @user_ad.login_required
    def suggestion(suggestion_request: SuggestionRequest):
        """This will receive most likely search terms and will return an AI response along with citations"""
        if not suggestion_request.query:
            return jsonify(
                {"error": "Request body must at least contain a query."}
            ), 400

        ## build a MessageRequest in order to send to the OpenAI API.
        message_request = MessageRequest(
            query=suggestion_request.query,
            messages=[],  # we don't need messages for this
            quotedText="",
            model="gpt-4o",
            top=10,
            lang=suggestion_request.lang,
            tools=["corporate"],
            corporateFunction=suggestion_request.corporate_function,
            uuid=str(uuid.uuid4()),
        )

        user = user_ad.current_user()
        thread = threading.Thread(target=store_suggestion, args=(message_request, user))
        thread.start()

        # Process language
        if suggestion_request.lang == "fr":
            logger.info("Process lang --> fr")
            message_request.messages = [
                Message(role="system", content=SUGGEST_SYSTEM_PROMPT_FR)
            ]
        elif suggestion_request.lang == "en":
            logger.info("Process lang --> en")
            message_request.messages = [
                Message(role="system", content=SUGGEST_SYSTEM_PROMPT_EN)
            ]
        else:
            abort(400, "Language not supported, must be 'fr' or 'en'")

        # Process system prompt
        if suggestion_request.system_prompt is not None:
            logger.debug(
                "System prompt was provided: %s", suggestion_request.system_prompt
            )
            message_request.messages = [
                Message(role="system", content=suggestion_request.system_prompt)
            ]

        # Do inference
        _, completion = chat_with_data(message_request)
        if not isinstance(completion, ChatCompletion):
            abort(500, message="Invalid completion type")

        # Convert ChatCompletion to Completion
        completion_response = convert_chat_with_data_response(completion)

        # Post Processing: Dedupe citations
        if completion_response.message.context and suggestion_request.dedupe_citations:
            logger.info("Deduping citations")
            citations: List[Citation] = completion_response.message.context.citations
            # Track seen URLs
            seen_urls = set()
            unique_citations = []

            # Loop through citations and filter out duplicates
            for citation in citations:
                if citation.url not in seen_urls:
                    seen_urls.add(citation.url)
                    unique_citations.append(citation)

            # Update the citations list with unique citations
            completion_response.message.context.citations = unique_citations
        # Post Processing: Remove markdown
        if suggestion_request.remove_markdown and completion_response.message.content:
            logger.info("Markdown removal")
            # Regular expression pattern to match [doc0] to [doc9999],
            # if we get more citations than this, call the cops
            pattern = r"\[doc[0-9]{0,4}\]"
            completion_response.message.content = re.sub(
                pattern, "", completion_response.message.content
            )

        return completion_response

@api_v1.get("/stats_report/monthly")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_stats_report_monthly():
    ctx = build_context()
    monthly_report = ctx["stats_report_service"].get_statistics_by_month_of_year()
    return jsonify(monthly_report), 200


@api_v1.get("/stats_report/weekly")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_stats_report_weekly():
    ctx = build_context()
    weekly_report = ctx["stats_report_service"].get_statistics_by_day_of_week()
    return jsonify(weekly_report), 200


@api_v1.get("/stats_report/top_users_90_days")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_stats_report_top_users_90_days():
    ctx = build_context()
    weekly_report = ctx["stats_report_service"].get_top_users_past_90_days()
    return jsonify(weekly_report), 200

@api_v1.get("/stats_report/monthly_user_engagement")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_monthly_user_engagement_report():
    ctx = build_context()
    weekly_report = ctx["stats_report_service"].get_monthly_user_engagement_report()
    return jsonify(weekly_report), 200
