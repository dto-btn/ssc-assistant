from typing import Literal, TypedDict, List


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
    dedupe_citations: bool | None


type SuggestionContextWithoutSuggestionsReason = Literal[
    "INVALID_QUERY", "INVALID_LANGUAGE"
]


class SuggestionCitation(TypedDict):
    """
    A citation for a suggestion, which includes the source URL.
    """

    url: str


class SuggestionResponseBase(TypedDict):
    """
    A base response for a suggestion, which includes the success flag.
    """

    original_query: str
    success: bool
    language: str
    timestamp: str
    requester: str


class SuggestionContextWithSuggestions(SuggestionResponseBase):
    """
    A suggestion context, which includes the body and citations. This is used
    internally.
    """

    success: Literal[True]
    content: str
    citations: List[SuggestionCitation]

class SuggestionContextWithSuggestionsAndId(SuggestionContextWithSuggestions):
    """
    A suggestion context with an added id. This is used on MySSCPlus's redirect call to
    initiate a new chat with the user that is based on the suggestion.
    """

    suggestion_id: str

class SuggestionContextWithoutSuggestions(SuggestionResponseBase):
    """
    A suggestion context, which includes the body. This is used to generate a suggestion.
    """

    success: Literal[False]
    reason: SuggestionContextWithoutSuggestionsReason


type SuggestionContext = (
    SuggestionContextWithSuggestions
    | SuggestionContextWithSuggestionsAndId
    | SuggestionContextWithoutSuggestions
)
