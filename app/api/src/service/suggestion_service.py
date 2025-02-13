from enum import Enum
import logging
import threading
from typing import Any, Literal, TypedDict, List
import uuid
from azure.data.tables import TableClient
from datetime import datetime
import threading
from utils.db import store_suggestion
from utils.manage_message import SUGGEST_SYSTEM_PROMPT_EN, SUGGEST_SYSTEM_PROMPT_FR
from utils.models import Message, MessageRequest
from utils.openai import chat_with_data


class SuggestRequestInternalValidationSuccess[T](TypedDict):
    """
    A response for a failed suggestion request validation.
    """

    is_valid: Literal[True]
    data: T


class SuggestRequestInternalValidationFailure(TypedDict):
    """
    A response for a failed suggestion request validation.
    """

    is_valid: Literal[False]
    reason: Literal["INVALID_QUERY", "INVALID_LANGUAGE"]


type SuggestRequestInternalValidationResult[T] = (
    SuggestRequestInternalValidationSuccess[T] | SuggestRequestInternalValidationFailure
)

class SuggestRequestOpts(TypedDict):
    """
    Options for generating a suggestion.
    """

    language: str
    requester: str
    system_prompt: str | None

type SuggestionContextWithoutSuggestionsReason = Literal[
    "INVALID_QUERY", "INVALID_LANGUAGE"
]

class SuggestionCitation(TypedDict):
    """
    A citation for a suggestion, which includes the content and source URL.
    """

    citation_display: str
    url: str

class SuggestionResponseBase(TypedDict):
    """
    A base response for a suggestion, which includes the has_suggestions flag.
    """

    original_query: str
    has_suggestions: bool
    language: str
    timestamp: str
    requester: str


class SuggestionContextWithSuggestions(SuggestionResponseBase):
    """
    A suggestion context, which includes the body and citations. This is used
    to generate a suggestion. It is also used on frontend's redirect call to
    initiate a new chat with the user that is based on the suggestion.
    """

    has_suggestions: Literal[True]
    suggestion_body: str
    suggestion_citations: List[SuggestionCitation]


class SuggestionContextWithoutSuggestions(SuggestionResponseBase):
    """
    A suggestion context, which includes the body. This is used to generate a suggestion.
    """

    has_suggestions: Literal[False]
    reason: SuggestionContextWithoutSuggestionsReason

type SuggestionContext = (
    SuggestionContextWithSuggestions | SuggestionContextWithoutSuggestions
)

logger = logging.getLogger(__name__)


class SuggestionService:
    """
    This service is responsible for creating suggestions and storing them in the database.
    """

    def __init__(self, suggest_client: TableClient):
        self.suggest_client = suggest_client
        pass

    def suggest(self, query: str, opts: SuggestRequestOpts) -> SuggestionContext:
        """
        Generate a suggestion based on the options provided.
        """
        query_validation_result: SuggestRequestInternalValidationResult[str] = (
            self._validate_and_clean_query(query)
        )
        opts_validation_result: SuggestRequestInternalValidationResult[
            SuggestRequestOpts
        ] = self._validate_and_clean_opts(opts)

        if query_validation_result["is_valid"] is False:
            return {
                # This will be set to False for invalid queries.
                "has_suggestions": False,
                "reason": query_validation_result["reason"],
            }

        if opts_validation_result["is_valid"] is False:
            return {
                # This will be set to False for invalid queries.
                "has_suggestions": False,
                "reason": opts_validation_result["reason"],
            }

        result = self._perform_chat(
            query_validation_result["data"], opts_validation_result["data"]
        )

        return {
            # This will be set to True for valid queries.
            "has_suggestions": True,
            # This will be either "en" or "fr", depending on the language of the suggestion.
            "language": opts_validation_result["data"]["language"],
            # This will be set to the query that was used to generate the suggestion.
            "original_query": query_validation_result["data"],
            # This will be set to the time the suggestion was generated.
            "timestamp": self._format_timestamp(self._generate_datetime_object()),
            # This will be set to the application that requested the suggestion.
            "requester": opts_validation_result["data"]["requester"],
            # This will be set to the body of the suggestion.
            "suggestion_body": "This will be a long-ish string that contains the suggestion, with references to citations.",
            # This will be a list of citations for the suggestion.
            "suggestion_citations": [
                {
                    "citation_display": "This is what you will display to the user as the citation.",
                    "url": "https://example.com",
                }
            ],
        }

    def _validate_and_clean_query(
        self, query: str
    ) -> SuggestRequestInternalValidationResult[str]:
        """
        Validate the query to ensure it is a valid query.
        """
        if not query:
            return {
                "is_valid": False,
                "reason": "INVALID_QUERY",
            }

        stripped_query = query.strip()

        # after strip, if query is empty, return False
        if not stripped_query:
            return {
                "is_valid": False,
                "reason": "INVALID_QUERY",
            }

        # if more cleaning is needed, add here
        # for now, return the stripped query

        return {"is_valid": True, "data": stripped_query}

    def _validate_and_clean_opts(
        self, opts: SuggestRequestOpts
    ) -> SuggestRequestInternalValidationResult[SuggestRequestOpts]:
        """
        Validate the options to ensure they are valid.
        """

        opts_language = opts.get("language", "") or ""
        opts["language"] = opts_language.strip().lower()
        if opts["language"] not in ["fr", "en"]:
            return {
                "is_valid": False,
                "reason": "INVALID_LANGUAGE",
            }

        opts_requester = opts.get("requester", "") or ""
        opts["requester"] = opts_requester.strip()
        if not opts["requester"]:
            # strip
            return {
                "is_valid": False,
                "reason": "REQUESTER_NOT_PROVIDED",
            }

        return {
            "is_valid": True,
            "data": opts,
        }

    def _generate_datetime_object(self) -> datetime:
        """
        Generate a timestamp for the suggestion.
        """
        return datetime.now()

    def _format_timestamp(self, timestamp: datetime) -> str:
        """
        Format the timestamp for display.
        """
        return timestamp.strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"

    def _perform_chat(self, query: str, opts: SuggestRequestOpts) -> SuggestionContext:
        ## build a MessageRequest in order to send to the OpenAI API.
        message_request = MessageRequest(
            query=query,
            messages=[],  # we don't need messages for this
            quotedText="",
            model="gpt-4o",
            top=10,
            lang=opts["language"],
            tools=["corporate"],
            corporateFunction="intranet_question",  # hardcoded for now
            uuid=str(uuid.uuid4()),
        )

        # TODO: Implement
        # user = user_ad.current_user()
        # thread = threading.Thread(target=store_suggestion, args=(message_request, user))
        # thread.start()

        # Process language
        if opts["language"] == "fr":
            logger.info("Process lang --> fr")
            message_request.messages = [
                Message(role="system", content=SUGGEST_SYSTEM_PROMPT_FR)
            ]
        elif opts["language"] == "en":
            logger.info("Process lang --> en")
            message_request.messages = [
                Message(role="system", content=SUGGEST_SYSTEM_PROMPT_EN)
            ]
        else:
            # this should never happen, but just in case
            return {
                "has_suggestions": False,
                "reason": "INVALID_LANGUAGE",
            }

        # Override with the system_prompt option if provided
        if opts.get("system_prompt") is not None:
            logger.debug("System prompt was provided: %s", opts["system_prompt"])
            message_request.messages = [
                Message(role="system", content=opts["system_prompt"])
            ]

        # Do inference
        _, completion = chat_with_data(message_request)

        # TODO: Implement the rest of it
        return {}

        # raise NotImplementedError("Need to implement the rest of this function.")
