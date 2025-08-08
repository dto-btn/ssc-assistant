from dataclasses import field
from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field

from marshmallow_dataclass import dataclass


@dataclass
class Metadata:
    chunking: str

@dataclass
class Citation:
    content: str
    url: str
    title: str
    chunk_id: Optional[str] = None
    id: Optional[Any] = None  # Using Any type as id is null in the provided JSON
    filepath: Optional[Any] = None  # Using Any type as filepath is null in the provided JSON

@dataclass
class Context:
    role: str
    citations: List[Citation]
    intent: List[str]

@dataclass
class ToolInfo:
    """Gives back info on the tool that was used, function and payload contained"""
    tool_type: str
    function_name: str
    count: int = field(default=1)
    payload: Dict[str, Union[Dict, list]] = field(default_factory=lambda: {})

@dataclass
class Attachment:
    """
    Supports various attachments, type, and blob storage location.
    example:
    { type: 'image', blob_storage_url: "https://somestorage.azurestorage.net/hash"}
    """
    type: str
    blob_storage_url: str

@dataclass
class Message:
    role: str
    quotedText: Optional[str] = None
    content: Optional[str] = None
    context: Optional[Context] = None
    tools_info: Optional[List[ToolInfo]] = None
    attachments: Optional[List[Attachment]] = None

@dataclass
class Completion:
    message: Message
    completion_tokens: Optional[int] = field(default=0)
    """Number of tokens in the generated completion."""
    prompt_tokens: Optional[int] = field(default=0)
    """Number of tokens in the prompt."""
    total_tokens: Optional[int] = field(default=0)
    """Total number of tokens used in the request (prompt + completion)."""

@dataclass
class MessageRequest:
    query: Optional[str]
    messages: Optional[List[Message]]
    quotedText: Optional[str]
    model: Literal['gpt-4o', 'gpt-4.1-nano']
    top: int = field(default=3)
    lang: str = field(default='en')
    max: int = field(default=10)
    tools: List[str] = field(default_factory=lambda: ["corporate", "geds"])
    corporateFunction: str = field(default='intranet_question')
    uuid: str = field(default='')
    fullName: str = field(default='')

@dataclass
class Feedback:
    feedback: Optional[str]
    positive: bool
    uuid: str = field(default='')

@dataclass
class BookingConfirmation:
    bookingType: str
    buildingId: str
    floorId: str
    roomId: str
    createdBy: str
    assignedTo: str
    startDate: str

@dataclass
class FilePayload:
    '''Contains the payload of the file uploaded to be fed to the OpenAI API'''
    encoded_file: str
    name: str

@dataclass
class SuggestionCitationApiResponse:
    url: str
    title: str


@dataclass
class SuggestionApiResponse:
    original_query: str
    success: Literal[True, False]
    language: str
    timestamp: str  # ISO format string expected
    requester: str

    # only provided if success is False
    reason: Optional[Literal["INVALID_QUERY", "INVALID_LANGUAGE"]] = None

    # not provided if success is False
    content: Optional[str] = None
    citations: Optional[List[SuggestionCitationApiResponse]] = None
    id: Optional[str] = None


@dataclass
class SuggestionApiRequest:
    """this is a suggestion request that most likely comes from the myssc+ search feature"""

    query: str
    opts: Dict[str, Any]

class AzureCognitiveSearchDataSourceConfig(BaseModel):
    """
    Configuration for Azure Cognitive Search data source used in OpenAI chat completions
    """
    index_name: str = Field(..., description="The name of the Azure Cognitive Search index")
    embedding_model: str = Field(..., description="The embedding model deployment name to use for vector search")
    top_n_documents: int = Field(default=3, description="The number of top documents to return from the index")
    use_language_filter: bool = Field(default=False,
                                      description="Whether to apply language filtering to search results")
    lang_filter: str = Field(default="", description="Language filter for search results (e.g., 'en', 'fr')")
    query_type: str = Field(default="vector_simple_hybrid",
                           description="The type of query to perform on the search index, eg. 'vector_semantic_hybrid' or 'vector_simple_hybrid'")
