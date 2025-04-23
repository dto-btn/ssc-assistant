from datetime import datetime
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
        user_query = BRQuery.model_validate_json(br_query)
        logger.info("Valided query: %s", user_query)

        # Prepare the SQL statement for this request.
        sql_query = query_builder.get_br_query(limit=bool(user_query.limit),
                                            br_filters=user_query.query_filters,
                                            active=True,
                                            status=len(user_query.statuses) if user_query.statuses else 0)

        # Build query parameters dynamically, #1 statuses, #2 all other fields, #3 limit
        query_params = []
        if user_query.statuses:
            query_params.extend(user_query.statuses)
        for query_filter in user_query.query_filters:
            if query_filter.is_date():
                query_params.append(query_filter.value)
            else:
                query_params.append(f"%{query_filter.value}%")
        query_params.append(user_query.limit)
        return db.execute_query(sql_query, *query_params)

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
            "properties": {},
            "required": []
        }
    }
  })
# pylint: enable=line-too-long
def get_br_statuses():
    """
    This will retreive the code table BR_STATUSES (Active == True)
    """
    script_dir = os.path.dirname(os.path.abspath(__file__))
    file_path = os.path.join(script_dir, "bits_statuses.json")
    with open(file_path, 'r', encoding='utf-8') as statuses:
        return { "statuses": json.load(statuses) }


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
    fields_with_descriptions = {
        key: value.get('description', '') for key, value in BRFields.valid_search_fields.items()
    }
    return {
        "field_names": json.dumps(fields_with_descriptions)
    }

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_current_date",
        "description": "This function is used to know what is the current date and time. It returns the current date and time in text format. Use this if you are unsure of what is the current date, do not make assumptions about the current date and time."
    }
  })
def get_current_date():
    """
    TODO: this perhaps should be moved into a more generic tools folder.
    """
    current_date_time = datetime.now()
    return { "date": "Formatted date and time:" + current_date_time.strftime("%Y-%m-%d %H:%M:%S") }
