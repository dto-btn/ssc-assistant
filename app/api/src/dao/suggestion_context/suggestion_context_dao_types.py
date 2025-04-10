from datetime import datetime
from typing import List
from src.service.suggestion_service_types import (
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)
from uuid import uuid4


# abstract version of the DAO
class BaseSuggestionContextDao:
    def get_suggestion_context_by_id(
        self, id: str
    ) -> SuggestionContextWithSuggestionsAndId:
        raise NotImplementedError

    def insert_suggestion_context(
        self, suggestion: SuggestionContextWithSuggestions
    ) -> SuggestionContextWithSuggestionsAndId:
        raise NotImplementedError

    def delete_suggestion_context_older_than(self, delete_before_inclusive: datetime):
        raise NotImplementedError
