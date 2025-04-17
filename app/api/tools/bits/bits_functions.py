import json
import logging
import os
from typing import List, Optional

from tools.bits.bits_models import BITSQuery
from src.constants.tools import TOOL_BR
from tools.bits.bits_utils import BITSQueryBuilder, DatabaseConnection, extract_fields_and_value_pairs
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
    query = query_builder.get_br_query(len(br_numbers), active=False) #BRs here do not need to be active to be returned
    return db.execute_query(query, *br_numbers)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "search_br_by_fields",
        "description": "This function searches information about BRs given specific BR field(s) and value(s) pairs. Concatenate the field name to the value via an equal sign (ex: 'RPT_GC_ORG_NAME_EN=Shared Services Canada'). The fields available are obtainable via valid_search_fields() functions. YOU MUST VALIDATE ANY FIELDS PASSED TO YOU, do not assume the user as a valid field name passed. If the user doesn't provide a `field_name` then let them know what the field names are. To Search by status use get_br_by_status() to confirm STATUS_ID. For date fields, you must pass it with a date matching YYYY-MM-DD and prefixed with <,> or =. Ex: ['SUBMIT_DATE=>2024-03-01', 'REQUEST_IMPL_DATE==2025-03-01']",
        "parameters": {
            "type": "object",
            "properties": {
                "fields_and_values": {
                    "type": "array",
                    "description": "A list of fields name(s) and their value(s) to filter BRs by. Ex: ['BR_OWNER=Bob Smith', 'BR_SHORT_TITLE=Windows 10']. DO NOT USE THIS FOR STATUSES.",
                    "items": {
                        "type": "string"
                    }
                },
                "statuses" : {
                    "type": "array",
                    "description": "A list of statuses to filter BRs by. Ex: ['Active', 'Inactive']. This is a list of STATUS_ID.",
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
            "required": []
      }
    }
  })
def search_br_by_fields(fields_and_values: Optional[List[str]] = None,
                        statuses: Optional[List[str]] = None,
                        limit: int = 100):
    """
    search_br_by_field

    Search BRs via a specific field:
    """
    if fields_and_values or statuses:
        dict_fields_and_values = {}
        # Now we need to validate any input the AI gave us to confirm the field names, and disregards the ones that
        # are not valid.
        if fields_and_values:
            dict_fields_and_values = extract_fields_and_value_pairs(fields_and_values, query_builder.base_fields)
            date_fields = extract_fields_and_value_pairs(fields_and_values, query_builder.date_fields)
            if date_fields:
                # if we have date fields we need to prepare them for the query.
                pass
        print(BITSQuery.model_json_schema())
        query = query_builder.get_br_query(limit=bool(limit),
                                           by_fields=list(dict_fields_and_values.keys()) if dict_fields_and_values else None,
                                           active=True,
                                           status=len(statuses) if statuses else 0,
                                           by_dates=None)
        # Build query parameters dynamically, #1 statuses, #2 all other fields, #3 limit
        query_params = []
        if statuses:
            query_params.extend(statuses)
        query_params.extend(f"%{value}%" for value in dict_fields_and_values.values() if dict_fields_and_values)
        query_params.append(limit)

        return db.execute_query(query, *query_params)
    return {
        "error": "Try using one of the following fields: " + ", ".join(list(query_builder.valid_search_fields.keys()))
        }

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
def valid_search_fields():
    """
    This function returns all the valid search fields
    """
    return json.dumps(query_builder.valid_search_fields.keys())
