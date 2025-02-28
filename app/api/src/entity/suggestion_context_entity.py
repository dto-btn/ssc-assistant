import datetime
from typing import Literal
from pydantic import BaseModel

# {
#     "summary": "With only the required options",
#     "value": {
#         # This will be set to True for valid queries.
#         "success": True,
#         # This will be either "en" or "fr", depending on the language of the suggestion.
#         "language": "en",
#         # This will be set to the query that was used to generate the suggestion.
#         "original_query": "What is SSC's content management system?",
#         # This will be set to the time the suggestion was generated.
#         "timestamp": "2022-01-01T00:00:00.000Z",
#         # This will be set to the application that requested the suggestion.
#         "requester": "mysscplus",
#         # This will be set to the body of the suggestion.
#         "content": "The content management system at SSC is... etc. etc. This content[doc1] can have doc references[doc2], but they will be removed if the remove_citations_from_content option is set to True",
#         # This will be a list of citations for the suggestion.
#         "citations": [
#             {
#                 "title": "Title of the citation",
#                 "url": "https://example.com",
#             },
#             {
#                 "title": "Duplicate Example",
#                 "url": "https://example.com/duplicate",
#             },
#             {
#                 "title": "Duplicate Example",
#                 "url": "https://example.com/duplicate",
#             },
#         ],
#     },


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
