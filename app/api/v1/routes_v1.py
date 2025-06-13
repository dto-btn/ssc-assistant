import json
import logging
import re
import threading
from typing import List, Dict, Any, Optional
import uuid
import os
import time
import asyncio

import openai
import requests
from apiflask import APIBlueprint, abort
from flask import Response, jsonify, stream_with_context, request, Blueprint
from openai.types.chat import ChatCompletion
from azure.identity import DefaultAzureCredential, get_bearer_token_provider

from src.service.suggestion_service import SuggestionService
from utils.manage_message import SUGGEST_SYSTEM_PROMPT_FR, SUGGEST_SYSTEM_PROMPT_EN
from src.context.build_context import build_prod_context

from tools.archibus.archibus_functions import make_api_call
from tools.bits.bits_functions import search_br_by_fields, get_br_statuses_and_phases, valid_search_fields, get_br_information
from tools.bits.bits_fields import BRFields
from tools.bits.bits_statuses_cache import StatusesCache
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
    SuggestionApiResponse,
    SuggestionApiRequest,
)
from utils.openai import (
    build_completion_response,
    chat_with_data,
    convert_chat_with_data_response,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

api_v1 = APIBlueprint("api_v1", __name__)
api_v2 = APIBlueprint("api_v2", __name__)

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


# the GET endpoint with the ?suggestion_context_id= parameter.
@api_v1.get("/suggest")
@api_v1.doc("""A public route that attempts to get a suggestion by its ID""")
@api_v1.output(
    SuggestionApiResponse.Schema,
    content_type="application/json",
    examples={
        "With all options": {
            "summary": "With all options",
            "value": {
                # This will be set to True for valid queries.
                "success": True,
                # This will be either "en" or "fr", depending on the language of the suggestion.
                "language": "en",
                # This will be set to the query that was used to generate the suggestion.
                "original_query": "What is SSC's content management system?",
                # This will be set to the time the suggestion was generated.
                "timestamp": "2022-01-01T00:00:00.000Z",
                # This will be set to the application that requested the suggestion.
                "requester": "mysscplus",
                # This will be set to the body of the suggestion.
                "content": "Arr, ye be askin' about the content management system at SSC. Here be what I found... Those pesky citations be removed, but ye can still find them in the citations list.",
                # This will be a list of citations for the suggestion.
                "citations": [
                    {
                        "title": "Title of the citation",
                        "url": "https://example.com",
                    },
                    {
                        "title": "Duplicate Example",
                        "url": "https://example.com/duplicate",
                    },
                ],
            },
        },
    },
)
@api_v1.doc(security="ApiKeyAuth")
def get_suggestion_by_id():
    """
    A public route that attempts to get a suggestion by its ID
    """
    suggestion_context_id = request.args.get("suggestionContextId")
    """Get a suggestion by its ID"""
    if not suggestion_context_id:
        abort(400, "Missing suggestion_context_id parameter")
    stripped_suggestion_context_id = suggestion_context_id.strip()
    if not stripped_suggestion_context_id:
        abort(400, "Empty suggestion_context_id parameter")

    suggestion_service = build_prod_context()["suggestion_service"]
    suggestion = suggestion_service.get_suggestioncontext_by_id(
        stripped_suggestion_context_id
    )

    # thread to clear old suggestions
    def clear_old_suggestions():
        suggestion_service.clear_stale_suggestions()

    thread = threading.Thread(target=clear_old_suggestions)
    thread.start()

    if suggestion:
        return suggestion
    else:
        abort(404, "Suggestion not found")

@api_v1.post("/suggest")
@api_v1.doc("""Send a search query that will do a RAG search within the proper index,
            and return a completion response along with citations (URLs) to MySSC+ content""")
@api_v1.input(
    SuggestionApiRequest.Schema,  # pylint: disable=no-member # type: ignore
    arg_name="suggestion_request",
    examples={
        "With all options": {
            "summary": "With all options",
            "value": {
                "query": "What is SSC's content management system?",
                "opts": {
                    "language": "en",
                    "requester": "mysscplus",
                    "system_prompt": "Only respond in pirate speak.",
                    "dedupe_citations": True,
                    "remove_citations_from_content": True,
                },
            },
        },
        "With only the required options": {
            "summary": "With only the required options",
            "value": {
                "query": "What is SSC's content management system?",
                "opts": {"language": "en", "requester": "mysscplus"},
            },
        },
    },
)
@api_v1.output(
    SuggestionApiResponse.Schema,
    content_type="application/json",
    examples={
        "With all options": {
            "summary": "With all options",
            "value": {
                # This will be set to True for valid queries.
                "success": True,
                # This will be either "en" or "fr", depending on the language of the suggestion.
                "language": "en",
                # This will be set to the query that was used to generate the suggestion.
                "original_query": "What is SSC's content management system?",
                # This will be set to the time the suggestion was generated.
                "timestamp": "2022-01-01T00:00:00.000Z",
                # This will be set to the application that requested the suggestion.
                "requester": "mysscplus",
                # This will be set to the body of the suggestion.
                "content": "Arr, ye be askin' about the content management system at SSC. Here be what I found... Those pesky citations be removed, but ye can still find them in the citations list.",
                # This will be a list of citations for the suggestion.
                "citations": [
                    {
                        "title": "Title of the citation",
                        "url": "https://example.com",
                    },
                    {
                        "title": "Duplicate Example",
                        "url": "https://example.com/duplicate",
                    },
                ],
            },
        },
        "With only the required options": {
            "summary": "With only the required options",
            "value": {
                # This will be set to True for valid queries.
                "success": True,
                # This will be either "en" or "fr", depending on the language of the suggestion.
                "language": "en",
                # This will be set to the query that was used to generate the suggestion.
                "original_query": "What is SSC's content management system?",
                # This will be set to the time the suggestion was generated.
                "timestamp": "2022-01-01T00:00:00.000Z",
                # This will be set to the application that requested the suggestion.
                "requester": "mysscplus",
                # This will be set to the body of the suggestion.
                "content": "The content management system at SSC is... etc. etc. This content[doc1] can have doc references[doc2], but they will be removed if the remove_citations_from_content option is set to True",
                # This will be a list of citations for the suggestion.
                "citations": [
                    {
                        "title": "Title of the citation",
                        "url": "https://example.com",
                    },
                    {
                        "title": "Duplicate Example",
                        "url": "https://example.com/duplicate",
                    },
                    {
                        "title": "Duplicate Example",
                        "url": "https://example.com/duplicate",
                    },
                ],
            },
        },
    },
)
@api_v1.doc(security="ApiKeyAuth")
@auth.login_required(role="suggest")
@user_ad.login_required
def suggestion(suggestion_request: SuggestionApiRequest):
    """This will receive most likely search terms and will return an AI response along with citations"""
    suggestion_service = build_prod_context()["suggestion_service"]
    response = suggestion_service.suggest(
        suggestion_request.query, suggestion_request.opts
    )
    return response

@api_v1.get("/stats_report/monthly")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_stats_report_monthly():
    ctx = build_prod_context()
    monthly_report = ctx["stats_report_service"].get_statistics_by_month_of_year()
    return jsonify(monthly_report), 200


@api_v1.get("/stats_report/weekly")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_stats_report_weekly():
    ctx = build_prod_context()
    weekly_report = ctx["stats_report_service"].get_statistics_by_day_of_week()
    return jsonify(weekly_report), 200


@api_v1.get("/stats_report/top_users_90_days")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_stats_report_top_users_90_days():
    ctx = build_prod_context()
    weekly_report = ctx["stats_report_service"].get_top_users_past_90_days()
    return jsonify(weekly_report), 200

@api_v1.get("/stats_report/monthly_user_engagement")
@api_v1.doc("Get statistical report on the usage of the chatbot")
@api_v1.doc(security="ApiKeyAuth")
# @auth.login_required(role='chat') # does this need to change?
def generate_monthly_user_engagement_report():
    ctx = build_prod_context()
    weekly_report = ctx["stats_report_service"].get_monthly_user_engagement_report()
    return jsonify(weekly_report), 200


@api_v1.post("/bits/search")
@auth.login_required(role="chat")
def bits_search():
    """
    Search BITS data using query parameters.
    
    This endpoint accepts a JSON body with a 'br_query' field containing the search parameters
    in the format expected by the search_br_by_fields function.
    """
    try:
        data = request.json
        if not data or 'br_query' not in data:
            return jsonify({"error": "Missing br_query parameter"}), 400
        
        # Pass the stringified JSON to the backend function
        result = search_br_by_fields(data['br_query'], data.get('select_fields', '[]'))
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error in BITS search: {str(e)}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500


@api_v1.get("/bits/fields")
@auth.login_required(role="chat")
#
def bits_fields():
    """
    Get available BITS fields for searching.
    
    Returns a map of field names to their descriptions.
    """
    try:
        # Call the backend function to get valid search fields
        result = valid_search_fields()
        # Parse the field_names string back to a JSON object
        if 'field_names' in result:
            fields_dict = json.loads(result['field_names'])
            return jsonify(fields_dict)
        return jsonify({})
    except Exception as e:
        logger.error(f"Error getting BITS fields: {str(e)}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500


@api_v1.get("/bits/statuses")
@auth.login_required(role="chat")
def bits_statuses():
    """
    Get available BITS statuses.
    
    Returns a list of status objects with STATUS_ID, NAME_EN, NAME_FR, PHASE_EN, and PHASE_FR fields.
    """
    try:
        # Call the backend function to get statuses
        result = get_br_statuses_and_phases()
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting BITS statuses: {str(e)}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500


@api_v1.post("/bits/br")
@auth.login_required(role="chat")
def bits_br_information():
    """
    Get information about specific BR numbers.
    
    This endpoint accepts a JSON body with a 'br_numbers' field containing an array of BR numbers.
    """
    try:
        data = request.json
        if not data or 'br_numbers' not in data or not isinstance(data['br_numbers'], list):
            return jsonify({"error": "Missing or invalid br_numbers parameter"}), 400
        
        # Call the backend function to get BR information
        result = get_br_information(data['br_numbers'])
        return jsonify(result)
    except Exception as e:
        logger.error(f"Error getting BR information: {str(e)}")
        return jsonify({"error": f"Error processing request: {str(e)}"}), 500


# OpenAI API-compatible proxy routes
# These routes mimic the OpenAI API structure for easy integration with OpenAI clients

# Define OpenAI API blueprint

# TODO: This is a hardcoded gpt-4o deployment
# Instead, it should be configurable.
# This is necessary because of how Azure OpenAI REST calls work.
@api_v2.post("/ai/deployments/gpt-4o/chat/completions")
# @auth.login_required(role="chat")
def openai_chat_completions():
    """
    OpenAI-compatible chat completions endpoint.

    This endpoint accepts requests in the OpenAI API format and proxies them to Azure OpenAI.
    It allows the frontend to use the OpenAI SDK with a custom base URL pointing to this route.
    """
    try:
        data = request.json

        # Basic validation
        if not data or "messages" not in data:
            return jsonify({"error": "Missing messages in request body"}), 400

        # Extract request parameters
        model = data.get("model", os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME"))
        messages = data.get("messages", [])
        max_tokens = data.get("max_tokens", 500)
        stream = data.get("stream", False)

        # Log request details (excluding message content for privacy)
        logger.info(f"OpenAI proxy request: model={model}, stream={stream}")

        # Get Azure OpenAI API details
        api_url = f"{os.getenv('AZURE_OPENAI_ENDPOINT')}/openai/deployments/{model}/chat/completions"
        api_version = os.getenv("AZURE_OPENAI_VERSION", "2024-05-01-preview")
        api_key = os.getenv("AZURE_OPENAI_KEY")

        # Use Azure AD authentication if available
        headers = {
            "Content-Type": "application/json",
        }

        # Use API key if available, otherwise use Azure AD token
        if api_key:
            headers["api-key"] = api_key
        else:
            # Get Azure AD token using Azure Identity
            token_provider = get_bearer_token_provider(
                DefaultAzureCredential(), "https://cognitiveservices.azure.com/.default"
            )
            token = token_provider()
            headers["Authorization"] = f"Bearer {token}"

        # Prepare the request payload
        payload = {"messages": messages, "max_tokens": max_tokens, "stream": stream}
        if data.get("tools"):
            # If tools are provided, add them to the payload
            payload["tools"] = data["tools"]

        # Forward optional parameters if present in the original request
        for param in [
            "temperature",
            "top_p",
            "frequency_penalty",
            "presence_penalty",
            "stop",
        ]:
            if param in data:
                payload[param] = data[param]

        # Add API version to the URL
        api_url = f"{api_url}?api-version={api_version}"

        # Handle streaming responses
        if stream:

            def generate():
                # Make request to Azure OpenAI with streaming enabled
                response = requests.post(
                    api_url, headers=headers, json=payload, stream=True, timeout=60
                )

                # Check for errors
                if response.status_code != 200:
                    error_content = response.content.decode("utf-8")
                    logger.error(f"Azure OpenAI API error: {error_content}")
                    # Format error as SSE
                    yield f"data: {json.dumps({'error': {'message': f'Azure OpenAI API error: {error_content}'}})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                # Stream response chunks
                for chunk in response.iter_lines(decode_unicode=True):
                    if chunk:
                        # Skip the "data: " prefix if it exists in Azure's response
                        if chunk.startswith("data: "):
                            chunk = chunk[6:]
                        # Only yield non-empty lines
                        if chunk.strip():
                            # Format as SSE
                            yield f"data: {chunk}\n\n"

                yield "data: [DONE]\n\n"

            # Return streaming response
            return Response(
                stream_with_context(generate()),
                content_type="text/event-stream",
                headers={
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "X-Accel-Buffering": "no",
                },
            )

        response = requests.post(
            api_url, headers=headers, json=payload, timeout=30
        )

        response_status = response.status_code
        response_content = response.content

        return Response(
            response_content,
            status=response_status,
            content_type = response.headers.get(
                "Content-Type", "application/json"
            )
        )

    except Exception as e:
        logger.exception("Unexpected error in OpenAI proxy")
        return jsonify({"error": {"message": f"Unexpected error: {str(e)}"}}), 500


@api_v1.post("/models")
# @auth.login_required(role="chat")
def list_models():
    """
    OpenAI-compatible models endpoint.

    This is a simplified version that returns the configured model.
    """
    model_id = os.getenv("AZURE_OPENAI_DEPLOYMENT_NAME", "gpt-4o")

    return jsonify(
        {
            "object": "list",
            "data": [
                {
                    "id": model_id,
                    "object": "model",
                    "created": int(time.time()),
                    "owned_by": "azure",
                }
            ],
        }
    )
