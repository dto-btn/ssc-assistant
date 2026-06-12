import logging
import re
from typing import Generator, List, Tuple, Union
import uuid
from datetime import datetime, timedelta
from src.dao.suggestion_context.suggestion_context_dao_types import (
    BaseSuggestionContextDao,
)
from src.service.suggestion_service_types import (
    SuggestRequestInternalValidationResult,
    SuggestRequestOpts,
    SuggestionContext,
    SuggestionContextWithSuggestionsAndId,
    SuggestionContextWithoutSuggestions,
)
from utils.manage_message import SUGGEST_SYSTEM_PROMPT_EN, SUGGEST_SYSTEM_PROMPT_FR
from utils.models import (
    Message,
    MessageRequest,
    SuggestionCitationApiResponse,
)
from utils.openai import build_completion_response, chat_with_data, convert_chat_with_data_response
from openai.types.chat import ChatCompletion

logger = logging.getLogger(__name__)


class SuggestionService:
    """
    This service is responsible for creating suggestions and storing them in the database.
    """

    # def __init__(self, suggest_client: TableClient):
    #     self.suggest_client = suggest_client

    def __init__(self, suggestion_context_dao: BaseSuggestionContextDao):
        self.suggestion_context_dao = suggestion_context_dao
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
                "success": False,
                "reason": query_validation_result["reason"],
            }

        if opts_validation_result["is_valid"] is False:
            return {
                # This will be set to False for invalid queries.
                "success": False,
                "reason": opts_validation_result["reason"],
            }

        result = self._perform_chat(
            query_validation_result["data"], opts_validation_result["data"]
        )

        if result["success"]:
            # Store the suggestion in the database only if it was successful.
            # (Otherwise, why bother? It won't be used as a redirect.)
            return self.suggestion_context_dao.insert_suggestion_context(result)
        else:
            return result

    def suggest_stream(
        self, query: str, opts: SuggestRequestOpts
    ) -> Union[SuggestionContextWithoutSuggestions, Tuple[MessageRequest, Generator[str, None, None]]]:
        """
        Validate inputs and build the MessageRequest for a streaming suggestion.
        Returns either an error dict or a tuple of (message_request, stream_generator).
        The route layer is responsible for yielding from the generator and assembling the final response.
        """
        query_validation_result = self._validate_and_clean_query(query)
        opts_validation_result = self._validate_and_clean_opts(opts)

        if query_validation_result["is_valid"] is False:
            return {"success": False, "reason": query_validation_result["reason"]}

        if opts_validation_result["is_valid"] is False:
            return {"success": False, "reason": opts_validation_result["reason"]}

        cleaned_query = query_validation_result["data"]
        cleaned_opts = opts_validation_result["data"]

        message_request = self._build_message_request(cleaned_query, cleaned_opts)
        if message_request is None:
            return {"success": False, "reason": "INVALID_LANGUAGE"}

        _, completion = chat_with_data(message_request, stream=True)

        # If we get a non-streaming response back (shouldn't happen but handle it)
        if isinstance(completion, ChatCompletion):
            completion_response = convert_chat_with_data_response(completion, message_request.lang)
            content = completion_response.message.content or ""

            def single_chunk_gen():
                yield content

            return (message_request, single_chunk_gen())

        def stream_gen():
            for chunk in completion:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content

        return (message_request, stream_gen())

    def build_suggestion_from_streamed_content(
        self, content: str, opts: SuggestRequestOpts, query: str, context_dict: dict | None
    ) -> SuggestionContext:
        """
        After streaming is complete, build the final SuggestionContext from the accumulated content.
        Applies the same post-processing as _perform_chat (dedupe citations, remove doc refs).
        """
        completion_response = build_completion_response(
            content=content,
            chat_completion_dict=context_dict,
            lang=opts["language"],
        )

        # Generate list of citations
        if getattr(completion_response.message, "context", None) is None:
            citations: List[SuggestionCitationApiResponse] = []
        else:
            citations: List[SuggestionCitationApiResponse] = [
                SuggestionCitationApiResponse(url=x.url, title=x.title)
                for x in completion_response.message.context.citations
            ]

        # Dedupe citations
        if completion_response.message.context and opts.get("dedupe_citations", False):
            seen_urls = set()
            unique_citations = []
            for citation in citations:
                if citation.url not in seen_urls:
                    seen_urls.add(citation.url)
                    unique_citations.append(
                        SuggestionCitationApiResponse(url=citation.url, title=citation.title)
                    )
            citations = unique_citations

        # Remove [docN] references from content
        final_content = content
        if opts.get("remove_citations_from_content", False):
            pattern = r"\[doc[0-9]{0,4}\]"
            final_content = re.sub(pattern, "", content)

        result = {
            "success": True,
            "language": opts["language"],
            "original_query": query,
            "timestamp": self._format_timestamp(self._generate_datetime_object()),
            "requester": opts["requester"],
            "content": final_content,
            "citations": [{"url": c.url, "title": c.title} for c in citations],
        }

        # Store the suggestion
        return self.suggestion_context_dao.insert_suggestion_context(result)

    def _build_message_request(self, query: str, opts: SuggestRequestOpts) -> MessageRequest | None:
        """
        Build a MessageRequest for the suggestion. Returns None if language is invalid.
        """
        message_request = MessageRequest(
            query=query,
            messages=[],
            quotedText="",
            model="gpt-4o",
            top=10,
            lang=opts["language"],
            tools=["corporate"],
            corporateFunction="intranet_question",
            uuid=str(uuid.uuid4()),
        )

        if opts["language"] == "fr":
            message_request.messages = [Message(role="system", content=SUGGEST_SYSTEM_PROMPT_FR)]
        elif opts["language"] == "en":
            message_request.messages = [Message(role="system", content=SUGGEST_SYSTEM_PROMPT_EN)]
        else:
            return None

        if opts.get("system_prompt") is not None:
            message_request.messages = [Message(role="system", content=opts["system_prompt"])]

        return message_request

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
                "success": False,
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
        if not isinstance(completion, ChatCompletion):
            return {
                "success": False,
                "reason": "INTERNAL_ERROR",
            }

        # # Convert ChatCompletion to Completion
        completion_response = convert_chat_with_data_response(completion, message_request.lang)

        # Generate list of citations, for later use
        if getattr(completion_response.message, "context", None) is None:
            citations: List[SuggestionCitationApiResponse] = []
        else:
            citations: List[SuggestionCitationApiResponse] = [
                SuggestionCitationApiResponse(url=x.url, title=x.title)
                for x in completion_response.message.context.citations
            ]

        # # Post Processing: Dedupe citations
        if completion_response.message.context and opts.get("dedupe_citations", False):
            logger.info("Deduping citations")
            # Track seen URLs
            seen_urls = set()
            unique_citations = []

            # Loop through citations and filter out duplicates
            for citation in citations:
                if citation.url not in seen_urls:
                    seen_urls.add(citation.url)
                    unique_citations.append(
                        SuggestionCitationApiResponse(
                            url=citation.url,
                            title=citation.title,
                        )
                    )

            # Update the citations list with unique citations
            citations = unique_citations

        # Post Processing: Remove markdown
        if completion_response.message.content and opts.get(
            "remove_citations_from_content", False
        ):
            logger.info("Markdown removal")
            # Regular expression pattern to match [doc0] to [doc9999],
            # if we get more citations than this, call the cops
            pattern = r"\[doc[0-9]{0,4}\]"
            completion_response.message.content = re.sub(
                pattern, "", completion_response.message.content
            )

        return {
            # This will be set to True for valid queries.
            "success": True,
            # This will be either "en" or "fr", depending on the language of the suggestion.
            "language": opts["language"],
            # This will be set to the query that was used to generate the suggestion.
            "original_query": query,
            # This will be set to the time the suggestion was generated.
            "timestamp": self._format_timestamp(self._generate_datetime_object()),
            # This will be set to the application that requested the suggestion.
            "requester": opts["requester"],
            # This will be set to the body of the suggestion.
            "content": completion_response.message.content,
            # This will be a list of citations for the suggestion.
            "citations": [{"url": c.url, "title": c.title} for c in citations],
        }

    def get_suggestioncontext_by_id(
        self,
        id: str,
    ) -> SuggestionContextWithSuggestionsAndId | None:
        """
        Get a suggestion context by its ID.
        """
        return self.suggestion_context_dao.get_suggestion_context_by_id(id)

    def clear_stale_suggestions(self) -> None:
        """
        Clears all suggestions older than 3 days.
        """
        cutoff = datetime.now() - timedelta(days=3)
        return self.suggestion_context_dao.delete_suggestion_context_older_than(cutoff)