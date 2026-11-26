import logging

from utils.decorators import tool_metadata

__all__ = ["telecom"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "telecom",
        "description": "The documents contain processes, service controls, and contextual information relating to the use and provisioning of mobile telephone services for Digital Transformation Canada and its partner clients.",
        "parameters": {
            "type": "object",
            "properties": {
                "query": {
                    "type": "string",
                    "description": "The telecommunications question about Digital Transformation Canada"
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
