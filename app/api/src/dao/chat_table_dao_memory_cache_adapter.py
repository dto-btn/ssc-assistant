from datetime import datetime
from typing import Union
from src.dao.chat_table_dao_types import ChatTableDaoInterface
from src.entity.table_row_entity import ChatTableRow

EXPIRY_TIME_SECS = 15 * 60  # 15 minutes


class ChatTableDaoMemoryCacheAdapter:
    """
    This is a temporary solution to cache the chat table data in memory. This is not a
    scalable solution and should be replaced with a proper caching solution.

    An important limitation of this temporary solution is that it will force users to
    wait for results to be fetched from the database if the cache is expired. The ideal
    solution will not have this limitation and will fetch the data from the cache while
    it is being updated in the background.
    """
    cache: Union[list[ChatTableRow], None] = None
    cache_populated_time: datetime | None = None
    chat_table_dao: ChatTableDaoInterface

    def __init__(self, chat_table_dao: ChatTableDaoInterface):
        self.chat_table_dao = chat_table_dao
        self.cache = {}

    def all(self) -> list[ChatTableRow]:
        is_expired = (
            self.cache_populated_time is None
            or (datetime.now() - self.cache_populated_time).seconds > EXPIRY_TIME_SECS
        )

        if "all" not in self.cache or is_expired:
            self.cache["all"] = self.chat_table_dao.all()
            self.cache_populated_time = datetime.now()

        return self.cache["all"]
