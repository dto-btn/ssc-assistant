import logging

from utils.decorators import tool_metadata

__all__ = ["telecom"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "telecom",
        "description": "The documents contain processes, service controls, and contextual information relating to the use and provisioning of mobile telephone services for Shared Services Canada and their Partner clients.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The question that relates to anything related to telecomunication within SSC"
                }
            }
        }
    }
})
def telecom(query: str): # pylint: disable=unused-argument
    """returns the name of the telecom index name"""
    return {
        "index_name": "telecom",
        "embedding_model": "text-embedding-3-large",
        "use_language_filter": False
    }
