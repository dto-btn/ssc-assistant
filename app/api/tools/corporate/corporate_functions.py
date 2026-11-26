import logging
import os

from utils.decorators import tool_metadata

__all__ = ["intranet_question"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

index_name: str = os.getenv("AZURE_SEARCH_INDEX_NAME", "current")


# pylint: disable=line-too-long
@tool_metadata(
    {
        "type": "function",
        "function": {
            "name": "intranet_question",
            "description": "Answers corporate questions about Digital Transformation Canada (DTC) / Transformation numérique Canada (TNC), including leadership and the CEO (PDG), and topics covered by the MySSC+/MonSPC+ intranet, such as accommodations, finance, workplace tools, and HR. Use this tool for historical SSC/SPC references in the intranet as well.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The corporate or intranet question about Digital Transformation Canada",
                    }
                },
            },
        },
    }
)
def intranet_question(query: str):  # pylint: disable=unused-argument
    """
    Returns the MySSC+ index (most up to date, generally the index alias named "current")
    """
    return {"index_name": index_name, "embedding_model": "text-embedding-ada-002", "use_language_filter": True}
