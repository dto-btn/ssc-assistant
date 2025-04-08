import json
import logging
import os
from typing import List

from src.constants.tools import TOOL_BR
from tools.bits.bits_utils import BITSQueryBuilder, DatabaseConnection, extract_fields_from_query
from utils.decorators import (discover_subfolder_functions_with_metadata,
                              tool_metadata)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

db = DatabaseConnection(os.getenv("BITS_DB_SERVER", "missing.domain"),
                        os.getenv("BITS_DB_USERNAME", "missing.username"),
                        os.getenv("BITS_DB_PWD", "missing.password"),
                        os.getenv("BITS_DB_DATABASE", "missing.dbname"))

query_builder = BITSQueryBuilder()

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_information",
        "description": "Returns Business Request(s) (BR) information. Can be invoked for one OR many BR numbers at the same time. I.e; Give me BR info for 12345, 32456 and 66123. Should only invoke this function once",
        "parameters": {
            "type": "object",
            "properties": {
                "br_numbers": {
                    "type": "array",
                    "description": "An Array containing all the Business Request (BR) numbers.",
                    "items": {
                        "type": "integer"
                    }
                }
            },
            "required": ["br_numbers"]
      }
    }
  })
def get_br_information(br_numbers: list[int]):
    """
    gets br information
    """
    query = query_builder.get_br_query(len(br_numbers))
    return db.execute_query(query, *br_numbers)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "search_br_by_fields",
        "description": "This function searches information about BRs given specific BR field(s) and value(s) pairs. YOU MUST ENSURE THAT YOU PASS THE FIELD NAMES AND THE VALUES IN THE SAME ORDER IN EACH RESPECTIVE LISTS.The fields available are: {fields}. If the user doesn't provide a `field_name` then let them know what the field names are. Otherwise use best guess.".replace("{fields}", ", ".join(list(query_builder.valid_search_fields.keys()))),
        "parameters": {
            "type": "object",
            "properties": {
                "field_names": {
                    "type": "array",
                    "description": "A list of fields name(s) to filter BRs by.",
                    "items": {
                        "type": "string"
                    }
                },
                "field_values": {
                    "type": "array",
                    "description": "A list of fields value(s) to filter BRs by.",
                    "items": {
                        "type": "string"
                    }
                },
                "limit": {
                    "type": "integer",
                    "description": "The maximum number of BR items to return. Defaults to 100.",
                    "default": 100
                }
            },
            "required": ["field_names", "field_values"]
      }
    }
  })
def search_br_by_fields(field_names: List[str], field_values: List[str], limit: int = 100):
    """
    search_br_by_field

    Search BRs via a specific field:
    """
    if field_names:
        fields = extract_fields_from_query(field_names, list(query_builder.valid_search_fields.keys()))
        if fields:
            query_fields = [query_builder.valid_search_fields[field] for field in fields]
            query = query_builder.get_br_query(limit=bool(limit), by_fields=query_fields, active=True)
            return db.execute_query(query, *(f"%{value}%" for value in field_values), limit)
    return {"error": "Try using one of the following fields: " + ", ".join(list(query_builder.valid_search_fields.keys()))}

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_statuses",
        "description": "Use this function to list all the BR Statuses. This can be used to get the STATUS_ID. To perform search in other queries.",
        "parameters": {
            "type": "object",
            "properties": {
                "active": {
                    "type": "boolean",
                    "description": "If true, only active statuses will be returned. Defaults to true."
                }
            },
            "required": []
      }
    }
  })
def get_br_statuses(active: bool = True):
    """
    This will retreive the code table BR_STATUSES
    """
    query = """
    SELECT STATUS_ID, BITS_STATUS_EN as NAME_EN, BITS_STATUS_FR as NAME_FR
    FROM EDR_CARZ.DIM_BITS_STATUS
    """

    if active:
        query += "WHERE BR_ACTIVE_EN = 'Active'"

    return db.execute_query(query, result_key="br_statuses")

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_by_status",
        "description": "Use this function to list all the BR filtered by a specific status.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "This is the status (STATUS_ID) that the user wants to filter the requests for. If you don't know the statuses beforehand call get_br_statuses() function to get STATUS_ID."
                },
                "limit": {
                    "type": "integer",
                    "description": "The maximum number of BR items to return. Defaults to 100.",
                    "default": 100
                },
                "assigned_to": {
                    "type": "string",
                    "description": "This is the name of the person that the BR is assigned to (BR_OWNER)"
                }
            },
            "required": ["status"]
      }
    }
  })
def get_br_by_status(status: str, assigned_to: str = "", limit: int = 100):
    """
    This will retreive BR filtered by status.
    """
    query = query_builder.get_br_query(status=True, limit=bool(limit))
    return db.execute_query(query, status, limit)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_organization_names",
        "description": "Use this function to list all organization and get a proper value for the RPT_GC_ORG_NAME_EN or RPT_GC_ORG_NAME_FR fields which are also refered to as clients. This can be invoked when a user is searching for BRs by a client name but is using the acronym. Example: Search for BRs with clients PC. You would resolve it to Parks Canada and search for RPT_GC_ORG_NAME_EN = Parks Canada.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
      }
    }
  })
def get_organization_names():
    """
    This will retreive organization so AI can look them up.
    """
    query = """
    SELECT GC_ORG_NAME_EN, GC_ORG_NAME_FR, ORG_SHORT_NAME, ORG_ACRN_EN, ORG_ACRN_FR, ORG_ACRN_BIL, ORG_WEBSITE 
    FROM EDR_CARZ.DIM_GC_ORGANIZATION
    """

    return db.execute_query(query, result_key="org_names")

@tool_metadata({
    "type": "function",
    "function": {
        "name": "how_to_search_brs",
        "description": "Use this function to help guide the user in their search for BRs. It will list all the functions here and their paremeter to help the AI guide the user in their search. If the question is asked in french please try to translate everything in french.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
      }
    }
  })
def how_to_search_brs():
    """
    This is a metadata function that will list all the functions
    here and their paremeter to help the AI guide the user in their search
    """
    functions = discover_subfolder_functions_with_metadata("tools.bits.bits_functions",
                                                           "tools/bits/bits_functions.py",
                                                           TOOL_BR)
    # filter out this function right here
    for key in list(functions.keys()):
        if key == "how_to_search_brs":
            del functions[key]

    metadata = {}
    for key, value in functions.items():
        metadata[key] = value['metadata']
    return json.dumps(metadata)
