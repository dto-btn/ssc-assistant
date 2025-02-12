from enum import Enum
from typing import Literal, TypedDict, List
from azure.data.tables import TableClient
from datetime import datetime


class SuggestRequestOpts(TypedDict):
    """
    Options for generating a suggestion.
    """

    language: str

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
        query = self._validate_and_clean_query(query)
        opts = self._validate_and_clean_opts(opts)

        if query is False:
            return {
                # This will be set to False for invalid queries.
                "has_suggestions": False,
                "reason": "INVALID_QUERY",
            }

        if opts is False:
            return {
                # This will be set to False for invalid queries.
                "has_suggestions": False,
                "reason": "INVALID_LANGUAGE",
            }

        return {
            # This will be set to True for valid queries.
            "has_suggestions": True,
            # This will be either "en" or "fr", depending on the language of the suggestion.
            "language": opts["language"],
            # This will be set to the query that was used to generate the suggestion.
            "original_query": query,
            # This will be set to the time the suggestion was generated.
            "timestamp": self._format_timestamp(self._generate_datetime_object()),
            # This will be set to the application that requested the suggestion.
            "requester": "mysscplus",
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

    def _validate_and_clean_query(self, query: str) -> str | Literal[False]:
        """
        Validate the query to ensure it is a valid query.
        """
        if not query:
            return False

        stripped_query = query.strip()

        # after strip, if query is empty, return False
        if not stripped_query:
            return False

        # if more cleaning is needed, add here
        # for now, return the stripped query

        return stripped_query

    def _validate_and_clean_opts(
        self, opts: SuggestRequestOpts
    ) -> SuggestRequestOpts | Literal[False]:
        """
        Validate the options to ensure they are valid.
        """
        # if more validation is needed, add here
        # for now, return the options as is

        # accept only fr or en
        if opts["language"] not in ["fr", "en"]:
            return False

        return opts

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