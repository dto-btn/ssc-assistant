from dataclasses import field
from marshmallow_dataclass import dataclass
from typing import Any, Dict, List, Literal, Optional

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
    tools_info: Optional[ToolInfo] = None
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
    model: Literal['gpt-4o', 'gpt-35-turbo-1106']
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
class SuggestionRequest:
    '''this is a suggestion request that most likely comes from the myssc+ search feature'''
    query: str
    corporate_function: str = field(default='intranet_question')
