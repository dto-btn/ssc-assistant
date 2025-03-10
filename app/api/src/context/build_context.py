import os
from typing import Union

from azure.identity import DefaultAzureCredential
from azure.data.tables import TableServiceClient

from src.dao.chat_table_dao_memory_cache_adapter import ChatTableDaoMemoryCacheAdapter
from src.context.context_types import AppContext, EnvSpecificDependencies
from src.dao.suggestion_context_dao import SuggestionContextDao
from src.service.stats_report_service import StatsReportService
from src.dao.chat_table_dao import ChatTableDaoImpl
from src.repository.conversation_repository import ConversationRepository
from src.service.suggestion_service import SuggestionService
from src.db.sql_session_provider import SqlSessionProvider, TestSqlSessionProvider

instance: Union[AppContext, None] = None

def _build_context(
    env_specific_dependencies: EnvSpecificDependencies, use_cache: bool = True
) -> AppContext:
    global instance
    if instance is None or not use_cache:
        credential = DefaultAzureCredential()
        table_service_client = TableServiceClient(
            endpoint=os.getenv("DATABASE_ENDPOINT") or "", credential=credential
        )
        chat_table_dao = ChatTableDaoMemoryCacheAdapter(
            ChatTableDaoImpl(table_service_client)
        )
        conversation_repo = ConversationRepository(chat_table_dao)
        stats_report_service = StatsReportService(conversation_repo)

        sql_session_provider = env_specific_dependencies["sql_session_provider"]

        suggestion_context_dao = SuggestionContextDao(sql_session_provider)
        suggestion_service = SuggestionService(suggestion_context_dao)

        instance = AppContext(
            credential=credential,
            table_service_client=table_service_client,
            chat_table_dao=chat_table_dao,
            conversation_repo=conversation_repo,
            stats_report_service=stats_report_service,
            suggestion_service=suggestion_service,
            suggestion_context_dao=suggestion_context_dao,
        )

    return instance

def build_prod_context() -> AppContext:
    SQL_CONNECTION_STRING: str | None = os.getenv("SQL_CONNECTION_STRING")
    if not SQL_CONNECTION_STRING:
        raise ValueError("SQL_CONNECTION_STRING environment variable is not set")
    sql_session_provider = SqlSessionProvider(SQL_CONNECTION_STRING)

    return _build_context(
        EnvSpecificDependencies(sql_session_provider=sql_session_provider),
        use_cache=False,
    )


def build_test_context(use_cache: bool = True) -> AppContext:
    return _build_context(
        EnvSpecificDependencies(
            sql_session_provider=TestSqlSessionProvider("not-a-real-connection-string")
        ),
        use_cache=use_cache,
    )
