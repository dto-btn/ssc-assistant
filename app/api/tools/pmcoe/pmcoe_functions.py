import logging

from utils.decorators import tool_metadata

__all__ = ["pmcoe"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


@tool_metadata(
    {
        "type": "function",
        "function": {
            "name": "pmcoe",
            "description": "Project Management Center of Excellence (PMCOE) content. Provides information related to project management, gate templates, and standardized templates to support consistent project delivery and documentation.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The question that relates to anything related to project managment or gate templates within SSC",
                    }
                },
            },
        },
    }
)
def pmcoe(query: str):  # pylint: disable=unused-argument
    """returns the name of the telecom index name"""
    return {"index_name": "pmcoe", "embedding_model": "text-embedding-3-large", "use_language_filter": True, 'top_n_documents': 20}
