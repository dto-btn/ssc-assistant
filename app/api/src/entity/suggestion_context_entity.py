import datetime
from typing import Literal
from pydantic import BaseModel

class SuggestionContextCitationEntity(BaseModel):
    title: str
    url: str


class SuggestionContextEntity(BaseModel):
    id: str
    success: bool
    language: Literal["en", "fr"]
    original_query: str
    timestamp: datetime.datetime
    requester: str
    content: str
    citations: list[SuggestionContextCitationEntity]
