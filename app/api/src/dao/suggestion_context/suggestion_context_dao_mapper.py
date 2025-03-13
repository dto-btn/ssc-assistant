from src.db.sql_entities import SuggestionContextSqlEntity
from src.service.suggestion_service_types import (
    SuggestionCitation,
    SuggestionContextWithSuggestions,
    SuggestionContextWithSuggestionsAndId,
)


class SuggestionContextDaoMapper:
    @staticmethod
    def from_sql(
        sql_entity: SuggestionContextSqlEntity,
    ) -> SuggestionContextWithSuggestionsAndId:
        return SuggestionContextWithSuggestionsAndId(
            suggestion_id=sql_entity.id,
            success=True,  # we never save a suggestion that was not successful
            language=sql_entity.language,
            original_query=sql_entity.original_query,
            timestamp=sql_entity.created_at,
            requester=sql_entity.requester,
            content=sql_entity.content,
            citations=[
                # Note that citations is a JSON table column
                SuggestionCitation(title=citation["title"], url=citation["url"])
                for citation in sql_entity.citations
            ],
        )

    @staticmethod
    def to_sql(entity: SuggestionContextWithSuggestions) -> SuggestionContextSqlEntity:
        sql_entity: SuggestionContextSqlEntity = SuggestionContextSqlEntity()
        sql_entity.id = None
        sql_entity.language = entity["language"]
        sql_entity.original_query = entity["original_query"]
        sql_entity.requester = entity["requester"]
        sql_entity.content = entity["content"]
        sql_entity.citations = [
            {"title": citation["title"], "url": citation["url"]}
            for citation in entity["citations"]
        ]
        sql_entity.created_at = entity["timestamp"]

        # suggestion_id=None,
        # success=entity["success"],
        # language=entity["language"],
        # original_query=entity["original_query"],
        # created_at=entity["timestamp"],
        # requester=entity["requester"],
        # content=entity["content"],
        # citations=[
        #     {"title": citation["title"], "url": citation["url"]}
        #     for citation in entity["citations"]
        # ],

        return sql_entity
