from dataclasses import field
from marshmallow_dataclass import dataclass
from typing import Any, Dict, List, Optional, Union

@dataclass
class Metadata:
    chunking: str

@dataclass
class Citation:
    content: str
    url: str
    metadata: Metadata
    chunk_id: str
    title: str
    id: Optional[Any] = None  # Using Any type as id is null in the provided JSON
    filepath: Optional[Any] = None  # Using Any type as filepath is null in the provided JSON


@dataclass
class ToolDataContent:
    citations: List[Citation]
    intent: List[str]

@dataclass
class Message:
    role: str
    content: Union[str, ToolDataContent]
    end_turn: Optional[bool]
    index: Optional[int]

@dataclass
class Completion:
    completion_tokens: Optional[int]
    """Number of tokens in the generated completion."""
    prompt_tokens: Optional[int]
    """Number of tokens in the prompt."""
    total_tokens: Optional[int]
    """Total number of tokens used in the request (prompt + completion)."""
    message: Optional[Message] = None
    messages: List[Message] = field(default_factory=list)

    def __post_init__(self):
        # Ensure that either message or messages is present, but not both or none
        if (self.message is None and self.messages is None) or (self.message is not None and self.messages is not None):
            raise ValueError("Either 'message' or 'messages' must be present, but not both.")

@dataclass
class MessageRequest:
    query: Optional[str]
    messages: Optional[List[Message]]
    top: int = field(default=3)