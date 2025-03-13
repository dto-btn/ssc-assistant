from typing import TypedDict
from azure.identity import DefaultAzureCredential
from azure.data.tables import TableServiceClient


from src.dao.suggestion_context.suggestion_context_dao import SuggestionContextDao
from src.dao.suggestion_context.suggestion_context_dao_types import (
    BaseSuggestionContextDao,
)
from src.service.stats_report_service import StatsReportService
from src.dao.chat_table_dao import ChatTableDaoImpl
from src.repository.conversation_repository import ConversationRepository
from src.service.suggestion_service import SuggestionService
from src.db.sql_session_provider import BaseSqlSessionProvider


class AppContext(TypedDict):
    credential: DefaultAzureCredential
    table_service_client: TableServiceClient
    chat_table_dao: ChatTableDaoImpl
    conversation_repo: ConversationRepository
    stats_report_service: StatsReportService
    sql_session_provider: BaseSqlSessionProvider
    suggestion_context_dao: BaseSuggestionContextDao
    suggestion_service: SuggestionService


class EnvSpecificDependencies(TypedDict):
    """
    This type represents the dependencies that are specific to the environment
    in which the application is running. For example, in a test environment or
    a production environment, the dependencies may be different.
    """

    sql_session_provider: BaseSqlSessionProvider
    suggestion_context_dao: BaseSuggestionContextDao