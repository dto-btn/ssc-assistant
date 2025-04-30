import logging

from utils.decorators import tool_metadata


logger = logging.getLogger(__name__)

__all__ = [
    "get_pmcoe_test_value",
]


@tool_metadata(
    {
        "type": "function",
        "function": {
            "name": "get_pmcoe_test_value",
            "description": "A test tool that replies with a value that user can use to validate that this tool was actually called.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    }
)
def get_pmcoe_test_value():
    logger.debug("PMCOE secret password tool called")
    return "Yes, it exists. The secret password is 'pineapple'."
