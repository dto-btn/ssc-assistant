from typing import Union
from src.dao.chat_table_dao_types import ChatTableDaoInterface
from src.entity.table_row_entity import ChatTableRow


class ChatTableDaoMemoryCacheAdapter:
    cache: Union[list[ChatTableRow], None] = None
    chat_table_dao: ChatTableDaoInterface

    def __init__(self, chat_table_dao: ChatTableDaoInterface):
        self.chat_table_dao = chat_table_dao
        self.cache = {}

    def all(self) -> list[ChatTableRow]:
        if "all" not in self.cache:
            self.cache["all"] = self.chat_table_dao.all()
        return self.cache["all"]
