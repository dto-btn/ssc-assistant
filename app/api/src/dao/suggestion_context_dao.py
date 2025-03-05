from datetime import datetime
from typing import List
from src.entity.suggestion_context_entity import SuggestionContextEntity

class SuggestionContextDao:
    """
    For now, this is an in-memory implementation of the SuggestionContextDao.
    It will be replaced with a database implementation in the future.
    """

    def __init__(self):
        self._suggestions: List[SuggestionContextEntity] = []

    def get_suggestion_context_by_id(self, id: str) -> SuggestionContextEntity:
        return next(
            (suggestion for suggestion in self._suggestions if suggestion.id == id),
            None,
        )

    def insert_suggestion_context(self, suggestion: SuggestionContextEntity):
        self._suggestions.append(suggestion)

    def delete_suggestion_context_older_than(self, delete_before_inclusive: datetime):
        """
        Deletes all suggestions older than delete_before.
        The cutoff is inclusive, so suggestions with a timestamp equal to the cutoff will also be deleted.
        """
        self._suggestions = [
            suggestion
            for suggestion in self._suggestions
            if suggestion.timestamp > delete_before_inclusive
        ]