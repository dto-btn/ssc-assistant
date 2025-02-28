from typing import List
from src.entity.suggestion_context_entity import SuggestionContextEntity


class SuggestionContextDao:
    """
    For now, this is an in-memory implementation of the SuggestionContextDao.
    It will be replaced with a database implementation in the future.
    """

    _suggestions: List[SuggestionContextEntity] = []

    def get_suggestion_context_by_id(self, id: str) -> SuggestionContextEntity:
        return next(
            (suggestion for suggestion in self._suggestions if suggestion.id == id),
            None,
        )
