from dataclasses import field
from enum import Enum
from marshmallow_dataclass import dataclass
from typing import Any, Dict, List, Optional

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
    tool_type: List[str] = field(default_factory=list)
    function_names: List[str] = field(default_factory=list)
    payload: Optional[Dict] = None

@dataclass
class Message:
    role: str
    quotedText: Optional[str] = None
    content: Optional[str] = None
    context: Optional[Context] = None
    tools_info: Optional[ToolInfo] = None

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
    top: int = field(default=3)
    lang: str = field(default='en')
    max: int = field(default=10)
    tools: List[str] = field(default_factory=lambda: ["corporate", "geds", "archibus"])
    uuid: str = field(default='')

class QueryType(Enum):
    VECTOR_SIMPLE_HYBRID = "vectorSimpleHybrid"

@dataclass
class AzureCognitiveSearchParameters:
    endpoint: str
    key: str
    indexName: str
    queryType: QueryType = QueryType.VECTOR_SIMPLE_HYBRID

@dataclass
class AzureCognitiveSearchDataSource:
    #type: str = field(init=False, default="AzureCognitiveSearch")
    type: str = field(init=False, default="azure_search")
    parameters: AzureCognitiveSearchParameters

@dataclass
class Feedback:
    feedback: Optional[str]
    positive: bool
    uuid: str = field(default='')