import logging

from utils.decorators import tool_metadata

__all__ = ["intranet_question"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@tool_metadata({
  "type": "function",
  "tool_type": "corporate",
  "function": {
    "name": "intranet_question",
    "description": "Answers questions that are related to Shared Services Canada (SSC) / Services Partagés Canada (SPC) or any corporate questions related to the intranet website (MySSC+/MonSPC+) or anything that could be found on it. It could be accomodations, finance, workplace tools, HR information, anything an employee could need as information in a day to day job.",
    "parameters": {
      "type": "object",
      "properties": {
        "query": {
          "type": "string",
          "description": "The question that relates to anything corporate or SSC"
        }
      },
      "required": ["query"]
    }
  }
})
def intranet_question(query: str = ""):
    """
    Never actually invoked ATM, this is bypassed in the openai.py 
    code to simply invoke the data_source parameters with the Azure Search Services so we get annotations back
    """
    pass