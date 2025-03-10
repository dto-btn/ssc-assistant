from typing import override
from sqlalchemy import create_engine
from sqlalchemy.orm import Session

class BaseSqlSessionProvider:
    def __init__(self, db_url: str):
        pass

    def provide(self) -> Session:
        pass


class SqlSessionProvider(BaseSqlSessionProvider):
    @override
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)

    @override
    def provide(self) -> Session:
        return Session(self.engine)

class TestSqlSessionProvider(BaseSqlSessionProvider):
    """
    This class should be used in tests to prevent the use of SQL sessions.
    """

    @override
    def provide(self) -> Session:
        raise UserWarning("SQL sessions should not be requested during tests!")