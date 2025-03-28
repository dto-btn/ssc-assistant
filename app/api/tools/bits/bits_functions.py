import json
import logging
import os
from typing import List, Optional

from src.constants.tools import TOOL_BR
from tools.bits.bits_utils import DatabaseConnection, extract_fields_from_query
from utils.decorators import (discover_subfolder_functions_with_metadata,
                              tool_metadata)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

db = DatabaseConnection(os.getenv("BITS_DB_SERVER", "missing.domain"),
                        os.getenv("BITS_DB_USERNAME", "missing.username"),
                        os.getenv("BITS_DB_PWD", "missing.password"),
                        os.getenv("BITS_DB_DATABASE", "missing.dbname"))

valid_search_fields = {
    #'BR_TITLE': 'br.BR_TITLE',
    'BR_SHORT_TITLE': 'br.BR_SHORT_TITLE',
    'RPT_GC_ORG_NAME_EN': 'br.RPT_GC_ORG_NAME_EN',
    'RPT_GC_ORG_NAME_FR': 'br.RPT_GC_ORG_NAME_FR',
    'ORG_TYPE_EN': 'br.ORG_TYPE_EN',
    'ORG_TYPE_FR': 'br.ORG_TYPE_FR',
    'REQST_IMPL_DATE': 'br.REQST_IMPL_DATE',
    'BR_TYPE_EN': 'br.BR_TYPE_EN',
    'BR_TYPE_FR': 'br.BR_TYPE_FR',
    'PRIORITY_EN': 'br.PRIORITY_EN',
    'PRIORITY_FR': 'br.PRIORITY_FR',
    'BR_OWNER': 'br.BR_OWNER',
    'SUBMIT_DATE': 'br.SUBMIT_DATE',
    'RVSD_TARGET_IMPL_DATE': 'br.RVSD_TARGET_IMPL_DATE',
    'BA_OPI': 'br.BA_OPI',
    'CPLX_EN': 'br.CPLX_EN',
    'CPLX_FR': 'br.CPLX_FR',
    'ACTUAL_IMPL_DATE': 'br.ACTUAL_IMPL_DATE',
    'AGRMT_END_DATE': 'br.AGRMT_END_DATE',
    'BA_TL': 'br.BA_TL',
    'TL_OPI': 'br.TL_OPI',
    'SOL_OPI': 'br.SOL_OPI',
    'PM_OPI': 'br.PM_OPI',
    'SCOPE_EN': 'br.SCOPE_EN',
    'SCOPE_FR': 'br.SCOPE_FR',
    'CSM_DIRTR': 'br.CSM_DIRTR',
    'CLIENT_REQST_SOL_DATE': 'br.CLIENT_REQST_SOL_DATE',
    'BA_PRICE_OPI': 'br.BA_PRICE_OPI',
    'SDM_TL_OPI': 'br.SDM_TL_OPI',
    'CLIENT_SUBGRP_EN': 'br.CLIENT_SUBGRP_EN',
    'CLIENT_SUBGRP_FR': 'br.CLIENT_SUBGRP_FR',
    'PROD_OPI': 'br.PROD_OPI',
    'PRPO_TARGET_DATE': 'br.PRPO_TARGET_DATE',
    'IMPL_SGNOFF_DATE': 'br.IMPL_SGNOFF_DATE',
    'GROUP_EN': 'br.GROUP_EN',
    'GROUP_FR': 'br.GROUP_FR',
    'ENGN_OPI': 'br.ENGN_OPI',
    'AGRMT_OPI': 'br.AGRMT_OPI',
    'ASSOC_BRS': 'br.ASSOC_BRS',
    'REQMT_OVRVW': 'br.REQMT_OVRVW',
    'BR_ACTIVE_EN': 's.BR_ACTIVE_EN',
    'BR_ACTIVE_FR': 's.BR_ACTIVE_FR',
    'BITS_STATUS_EN': 's.BITS_STATUS_EN',
    'BITS_STATUS_FR': 's.BITS_STATUS_FR'
}

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
    query = _get_br_query(len(br_numbers))
    result = db.execute_query(query, *br_numbers)
    return {'br': result}

# @tool_metadata({
#     "type": "function",
#     "function": {
#         "name": "get_br_assigned_to",
#         "description": "Gets information about BRs assigned to a given name. If no limit is specified, it returns the top 10 items by default. List of fields a user can specify in assigned_to_fields: {fields}".replace("{fields}", ", ".join(valid_assigned_to_fields)),
#         "parameters": {
#             "type": "object",
#             "properties": {
#                 "name": {
#                     "type": "string",
#                     "description": "The name to search for in the BR records. This can be the BR owner, initiator, last editor, or other specified roles."
#                 },
#                 "limit": {
#                     "type": "integer",
#                     "description": "The maximum number of BR items to return. Defaults to 10.",
#                     "default": 10
#                 },
#                 "assigned_to_fields": {
#                     "type": "string",
#                     "description": "This is a list of comma separated fields that the user wants to filter this request on."
#                 }
#             },
#             "required": ["name"]
#         }
#     }
# })
# def get_br_assigned_to(name: str, limit: int = 10, assigned_to_fields: str = ""):
#     """
#     Gets BR information assigned to a given name.
#     """
#     fields = []
#     # If no specific fields are provided, use all valid fields
#     if assigned_to_fields:
#         assigned_to_fields_list = [field.strip() for field in assigned_to_fields.split(',')]
#         fields = extract_fields_from_query(assigned_to_fields_list, valid_assigned_to_fields)
#         # If no valid specific fields are provided, default to all valid fields
#         if not fields:
#             fields = valid_assigned_to_fields
#     else:
#         fields = valid_assigned_to_fields

#     condition = " OR ".join([f"{field} LIKE %s" for field in fields])
#     query = f"""
#     WITH MatchedRows AS (
#         SELECT *
#         FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS
#         WHERE {condition}
#     )
#     SELECT TOP(%d) *, (SELECT COUNT(*) FROM MatchedRows) AS TotalCount
#     FROM MatchedRows;
#     """

#     name_pattern = f"{name}%"
#     params = [name_pattern] * len(fields) + [limit]
#     result = db.execute_query(query, *params)
#     return {'br': result}

@tool_metadata({
    "type": "function",
    "function": {
        "name": "search_br_by_field",
        "description": "A 'BR' is a 'Business Request', which includes information about purchase orders inside the Government of Canada. This function searches information about BRs given a specific BR field (labelled `field_name`). If multiple fields are needed, invoke this function multiple times... once for each field. The fields available are: {fields}. If the user doesn't provide a `field_name` then let them know what the field names are. Otherwise use best guess.".replace("{fields}", ", ".join(list(valid_search_fields.keys()))),
        "parameters": {
            "type": "object",
            "properties": {
                "field_name": {
                    "type": "string",
                    "description": "A field name to filter BRs by."
                },
                "field_value": {
                    "type": "string",
                    "description": "A field value to filter BRs by."
                },
                "limit": {
                    "type": "integer",
                    "description": "The maximum number of BR items to return. Defaults to 50.",
                    "default": 50
                }
            },
            "required": ["field_name", "field_value"]
      }
    }
  })
def search_br_by_field(field_name: str, field_value: str, limit: int = 50):
    """
    search_br_by_field

    Search BRs via a specific field:
    """
    if field_name:
        fields = extract_fields_from_query([field_name], list(valid_search_fields.keys()) )
        if fields:
            query = _get_br_query(limit=bool(limit), by_field=valid_search_fields[fields[0]])
            result = db.execute_query(query, limit, f"%{field_value}%")
            return {'br': result}
    return "Try using one of the following fields: " + ", ".join(list(valid_search_fields.keys()))

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
    print(metadata)
    return json.dumps(metadata)

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

    result = db.execute_query(query)
    return {'br_statuses': result}

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
                    "description": "The maximum number of BR items to return. Defaults to 50.",
                    "default": 50
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
def get_br_by_status(status: str, assigned_to: str = "", limit: int = 50):
    """
    This will retreive BR filtered by status.
    """
    query = _get_br_query(status=True, limit=bool(limit))
    result = db.execute_query(query, limit, status)
    return {'br': result}

def _get_br_query(br_number_count: int = 0,
                    status: bool = False,
                    limit: bool = False,
                    active: bool = False,
                    by_field: str = "") -> str:
    """Function that will build the select statement for retreiving BRs

    NOTE: No need to join on ORGANIZATION Table atm.. some info is already rolled in BR ITEMS ...
    """
    query = "SELECT\n"

    # Limit amount of results
    if limit:
        query += "TOP(%d)\n"

    # Default select statement from BR_ITEMS & other tables
    query += "br.BR_NMBR as BR_NMBR," + ",".join([f"{value} as {key}" for key, value in valid_search_fields.items()])

    # Deault FROM statement
    query += """
    FROM
        [EDR_CARZ].[DIM_DEMAND_BR_ITEMS] br
    """

    # Processing BR SNAPSHOT clause
    snapshot_where_clause = ["PERIOD_END_DATE > GETDATE()"]
    if status:
        snapshot_where_clause.append("STATUS_ID IN (%s)")

    snapshot_where_clause = " AND ".join(snapshot_where_clause)
    query += f"""
    INNER JOIN
        (SELECT BR_NMBR, STATUS_ID
        FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT]
        WHERE {snapshot_where_clause}) snp
    ON snp.BR_NMBR = br.BR_NMBR
    """

    # Processing BR STATUS clause
    query += """
    INNER JOIN
        [EDR_CARZ].[DIM_BITS_STATUS] s
    ON s.STATUS_ID = snp.STATUS_ID
    """

    # WHERE CLAUSE PROCESSING (BR_NMBR and ACTIVE, etc)
    base_where_clause = []
    if active:
        base_where_clause.append("s.BR_ACTIVE_EN = 'Active'")

    if br_number_count:
        # Prevents SQL injection, this only calculates the placehoders ... i.e; BR_NMBR IN (%s, %s, %s)
        placeholders = ", ".join(["%s"] * br_number_count)
        base_where_clause.append(f"br.BR_NMBR IN ({placeholders})")

    if by_field:
        base_where_clause.append(by_field + " LIKE %s")

    if base_where_clause:
        query += "WHERE " + " AND ".join(base_where_clause)
    return query
