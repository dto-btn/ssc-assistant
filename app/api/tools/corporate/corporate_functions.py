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
            "description": "Answers questions that are related to Shared Services Canada (SSC) / Services Partagés Canada (SPC) or any corporate questions related to the intranet website (MySSC+/MonSPC+) or anything that could be found on it. It could be accomodations, finance, workplace tools, HR information, anything an employee could need as information in a day to day job.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The question that relates to anything corporate or SSC",
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
