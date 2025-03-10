from sqlalchemy import create_engine
from sqlalchemy.orm import Session


class SqlSessionProvider:
    def __init__(self, db_url: str):
        self.db_url = db_url
        self.engine = create_engine(db_url)

    def provide(self) -> Session:
        return Session(self.engine)
