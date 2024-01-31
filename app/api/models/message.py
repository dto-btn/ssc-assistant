from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

@dataclass
class Metadata:
    filename: str
    url: str
    title: str
    date: str
    nid: str
    langcode: str

@dataclass
class Node:
    id_: str
    metadata: Metadata
    score: Optional[float]
    text: str

@dataclass
class Message:
    role: str
    content: str
    #metadata: Optional[Dict[str, Dict[str, Any]]] = field(default_factory=dict)
    nodes: Optional[List[Node]] = field(default_factory=list)  