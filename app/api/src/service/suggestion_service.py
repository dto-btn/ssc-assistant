from typing import TypedDict, List
from azure.data.tables import TableClient


class SuggestOpts(TypedDict):
    """
    Options for generating a suggestion.
    """

    pass


class SuggestionCitation(TypedDict):
    """
    A citation for a suggestion, which includes the content and source URL.
    """

    content: str
    url: str


class SuggestionContext(TypedDict):
    """
    A suggestion context, which includes the body and citations. This is used
    to generate a suggestion. It is also used on frontend's redirect call to
    initiate a new chat with the user that is based on the suggestion.
    """

    body: str
    citations: List[SuggestionCitation]


class SuggestionService:
    """
    This service is responsible for creating suggestions and storing them in the database.
    """

    def __init__(self, suggest_client: TableClient):
        self.suggest_client = suggest_client
        pass

    def suggest(self, query: str, opts: SuggestOpts) -> SuggestionContext:
        """
        Generate a suggestion based on the options provided.
        """

        pass
