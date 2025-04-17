import json
import logging
import os

from pydantic import ValidationError
from src.constants.tools import TOOL_BR
from tools.bits.bits_fields import BRFields
from tools.bits.bits_models import BRQuery
from tools.bits.bits_utils import BRQueryBuilder, DatabaseConnection
from utils.decorators import (discover_subfolder_functions_with_metadata,
                              tool_metadata)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

db = DatabaseConnection(os.getenv("BITS_DB_SERVER", "missing.domain"),
                        os.getenv("BITS_DB_USERNAME", "missing.username"),
                        os.getenv("BITS_DB_PWD", "missing.password"),
                        os.getenv("BITS_DB_DATABASE", "missing.dbname"))

query_builder = BRQueryBuilder()

# pylint: disable=line-too-long
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
# pylint: enable=line-too-long
def get_br_information(br_numbers: list[int]):
    """
    gets br information
    """
    query = query_builder.get_br_query(len(br_numbers), active=False) #BRs here do not need to be active to be returned
    return db.execute_query(query, *br_numbers)

# pylint: disable=line-too-long
@tool_metadata({
    "type": "function",
    "function": {
        "name": "search_br_by_fields",
        "description": "This function searches information about BRs given specific BR field(s) and value(s) pairs.",
        "parameters": {
            "type": "object",
            "properties": {
                "br_query": {
                    "type": "string",
                    "description": "A stringified JSON object that match the BRQuery model.",
                }
            },
            "required": ["br_query"]
      }
    }
  })
# pylint: enable=line-too-long
def search_br_by_fields(br_query: str):
    """
    search_br_by_field

    Search BRs via a specific field:
    """
    try:
        br_query_dict = json.loads(br_query)
        validated_query = BRQuery(**br_query_dict)
        logger.info("Valided query: %s", validated_query)

        # Prepare the SQL statement for this request.
        query = query_builder.get_br_query(limit=bool(validated_query.limit),
                                            br_filters=validated_query.query_filters,
                                            active=True,
                                            status=len(validated_query.statuses) if validated_query.statuses else 0)

        # Build query parameters dynamically, #1 statuses, #2 all other fields, #3 limit
        query_params = []
        if validated_query.statuses:
            query_params.extend(validated_query.statuses)
        query_params.extend(
            f"%{query_filter.value}%" for query_filter in validated_query.query_filters if validated_query.query_filters
            )
        query_params.append(validated_query.limit)
        return db.execute_query(query, *query_params)

    except (json.JSONDecodeError, ValidationError) as e:
        # Handle validation errors
        logger.error("Validation failed!")
        return {
            "error": str(e)
            }

# pylint: disable=line-too-long
@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_statuses",
        "description": "Use this function to list all the BR Statuses. This can be used to get the STATUS_ID. To perform search in other queries. NEVER ASSUME THE USER GIVES YOU A VALID STATUS. ALWAYS USE THIS FUNCTION TO GET THE LIST OF STATUSES AND THEIR ID.",
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
# pylint: enable=line-too-long
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

# pylint: disable=line-too-long
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
# pylint: enable=line-too-long
def get_organization_names():
    """
    This will retreive organization so AI can look them up.
    """
    query = """
    SELECT GC_ORG_NAME_EN, GC_ORG_NAME_FR, ORG_SHORT_NAME, ORG_ACRN_EN, ORG_ACRN_FR, ORG_ACRN_BIL, ORG_WEBSITE
    FROM EDR_CARZ.DIM_GC_ORGANIZATION
    """

    return db.execute_query(query, result_key="org_names")

# pylint: disable=line-too-long
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
# pylint: enable=line-too-long
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

# pylint: disable=line-too-long
@tool_metadata({
    "type": "function",
    "function": {
        "name": "valid_search_fields",
        "description": "Use this function to list all the valid search fields. This can be used to get the field names that are available to search for BRs.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
      }
    }
  })
# pylint: enable=line-too-long
def valid_search_fields():
    """
    This function returns all the valid search fields
    """
    keys = list(BRFields.valid_search_fields.keys())
    return {
        "field_names": json.dumps(keys)
    }
