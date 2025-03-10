from typing import TypedDict
from azure.identity import DefaultAzureCredential
from azure.data.tables import TableServiceClient


from src.dao.suggestion_context_dao import SuggestionContextDao
from src.service.stats_report_service import StatsReportService
from src.dao.chat_table_dao import ChatTableDaoImpl
from src.repository.conversation_repository import ConversationRepository
from src.service.suggestion_service import SuggestionService
from src.db.sql_session_provider import SqlSessionProvider


class AppContext(TypedDict):
    credential: DefaultAzureCredential
    table_service_client: TableServiceClient
    chat_table_dao: ChatTableDaoImpl
    conversation_repo: ConversationRepository
    stats_report_service: StatsReportService
    sql_session_provider: SqlSessionProvider
    suggestion_context_dao: SuggestionContextDao
    suggestion_service: SuggestionService