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

valid_assigned_to_fields = [
        'BR_OWNER', 'BR_INITR', 'BR_LAST_EDITOR', 'CSM_OPI', 'TL_OPI', 'CSM_DIRTR', 'SOL_OPI',
        'ENGN_OPI', 'BA_OPI', 'BA_TL', 'PM_OPI', 'BA_PRICE_OPI', 'QA_OPI', 'SL_COORD', 'AGRMT_OPI',
        'ACCT_MGR_OPI', 'SDM_TL_OPI'
    ]

valid_search_fields = [
    'BR_TITLE', 'BR_SHORT_TITLE', 'PRIORITY_EN', 'PRIORITY_FR', 'CLIENT_NAME_SRC',
    'RPT_GC_ORG_NAME_EN', 'RPT_GC_ORG_NAME_FR', 'GROUP_ID', 'GROUP_EN', 'GROUP_FR'
]

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
    query = _get_br_query(br_numbers)
    result = db.execute_query(query, *br_numbers)
    return {'br': result}

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_assigned_to",
        "description": "Gets information about BRs assigned to a given name. If no limit is specified, it returns the top 10 items by default. List of fields a user can specify in assigned_to_fields: {fields}".replace("{fields}", ", ".join(valid_assigned_to_fields)),
        "parameters": {
            "type": "object",
            "properties": {
                "name": {
                    "type": "string",
                    "description": "The name to search for in the BR records. This can be the BR owner, initiator, last editor, or other specified roles."
                },
                "limit": {
                    "type": "integer",
                    "description": "The maximum number of BR items to return. Defaults to 10.",
                    "default": 10
                },
                "assigned_to_fields": {
                    "type": "string",
                    "description": "This is a list of comma separated fields that the user wants to filter this request on."
                }
            },
            "required": ["name"]
        }
    }
})
def get_br_assigned_to(name: str, limit: int = 10, assigned_to_fields: str = ""):
    """
    Gets BR information assigned to a given name.
    """
    fields = []
    # If no specific fields are provided, use all valid fields
    if assigned_to_fields:
        assigned_to_fields_list = [field.strip() for field in assigned_to_fields.split(',')]
        fields = extract_fields_from_query(assigned_to_fields_list, valid_assigned_to_fields)
        # If no valid specific fields are provided, default to all valid fields
        if not fields:
            fields = valid_assigned_to_fields
    else:
        fields = valid_assigned_to_fields

    condition = " OR ".join([f"{field} LIKE %s" for field in fields])
    query = f"""
    WITH MatchedRows AS (
        SELECT *
        FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS
        WHERE {condition}
    )
    SELECT TOP(%d) *, (SELECT COUNT(*) FROM MatchedRows) AS TotalCount
    FROM MatchedRows;
    """

    name_pattern = f"{name}%"
    params = [name_pattern] * len(fields) + [limit]
    result = db.execute_query(query, *params)
    return {'br': result}

@tool_metadata({
    "type": "function",
    "function": {
        "name": "search_br_by_field",
        "description": "A 'BR' is a 'Business Request', which includes information about purchase orders inside the Government of Canada. This function searches information about BRs given a specific BR field (labelled `field_name`). If multiple fields are needed, invoke this function multiple times... once for each field. The fields available are: {fields}. If the user doesn't provide a `field_name` then let them know what the field names are. Otherwise use best guess.".replace("{fields}", ", ".join(valid_search_fields)),
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
                    "description": "The maximum number of BR items to return. Defaults to 10.",
                    "default": 10
                }
            },
            "required": ["field_name", "field_value"]
      }
    }
  })
def search_br_by_field(field_name: str, field_value: str, limit: int = 10):
    """
    search_br_by_field

    Search BRs via a specific field:
    """
    if field_name:
        fields = extract_fields_from_query([field_name], valid_search_fields)
        if fields:
            query = """SELECT TOP(%d) *
                       FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS
                       WHERE {field} LIKE %s;""".replace("{field}", fields[0])
            result = db.execute_query(query, limit, f"%{field_value}%")
            return {'br': result}
    return "Try using one of the following fields: " + ", ".join(valid_search_fields)

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
            "properties": {},
            "required": []
      }
    }
  })
def get_br_statuses():
    """
    This will retreive the code table BR_STATUSES
    """
    query = "SELECT * FROM [EDR_CARZ].[DIM_BITS_STATUS];"
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
    This will retreive the code table BR_STATUSES
    """
    query = _get_br_query(status=status, limit=limit)
    result = db.execute_query(query, limit, status)
    return {'br': result}

def _get_br_query(br_numbers: Optional[List[int]] = None, status: str = "", limit: int = 0) -> str:
    """Function that will build the select statement for retreiving BRs

    NOTE: No need to join on ORGANIZATION Table atm.. some info is already rolled in BR ITEMS ...
    """
    if br_numbers is None:
        br_numbers = []
    if limit:
        base_query = "SELECT TOP(%d) "
    else:
        base_query = "SELECT "
    base_query += """
        br.BR_NMBR,
        br.BR_TITLE,
        br.BR_SHORT_TITLE,
        br.RPT_GC_ORG_NAME_EN,
        br.RPT_GC_ORG_NAME_FR,
        br.ORG_TYPE_EN,
        br.ORG_TYPE_FR,
        br.REQST_IMPL_DATE,
        br.BR_TYPE_EN,
        br.BR_TYPE_FR,
        br.PRIORITY_EN,
        br.PRIORITY_FR,
        br.BR_OWNER,
        br.SUBMIT_DATE,
        br.RVSD_TARGET_IMPL_DATE,
        br.BA_OPI,
        br.CPLX_EN,
        br.CPLX_FR,
        br.ACTUAL_IMPL_DATE,
        br.AGRMT_END_DATE,
        br.BA_TL,
        br.TL_OPI,
        br.SOL_OPI,
        br.PM_OPI,
        br.SCOPE_EN,
        br.SCOPE_FR,
        br.CSM_DIRTR,
        br.CLIENT_REQST_SOL_DATE,
        br.BA_PRICE_OPI,
        br.SDM_TL_OPI,
        br.CLIENT_SUBGRP_EN,
        br.CLIENT_SUBGRP_FR,
        br.PROD_OPI,
        br.PRPO_TARGET_DATE,
        br.IMPL_SGNOFF_DATE,
        br.GROUP_EN,
        br.GROUP_FR,
        br.ENGN_OPI,
        br.AGRMT_OPI,
        br.BA_PRICE_OPI,
        br.ASSOC_BRS,
        br.REQMT_OVRVW,
        s.BR_ACTIVE_EN,
        s.BR_ACTIVE_FR,
        s.BITS_STATUS_EN,
        s.BITS_STATUS_FR
    FROM
        [EDR_CARZ].[DIM_DEMAND_BR_ITEMS] br
    """

    if status:
        base_query += """
        INNER JOIN
            (SELECT BR_NMBR, STATUS_ID
            FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT]
            WHERE PERIOD_END_DATE > GETDATE() AND STATUS_ID IN (%s)) snp
        ON snp.BR_NMBR = br.BR_NMBR
        """
    else:
        base_query += """
        INNER JOIN
            (SELECT BR_NMBR, STATUS_ID
            FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT]
            WHERE PERIOD_END_DATE > GETDATE()) snp
        ON snp.BR_NMBR = br.BR_NMBR
        """

    base_query += """
    INNER JOIN
        [EDR_CARZ].[DIM_BITS_STATUS] s
    ON s.STATUS_ID = snp.STATUS_ID
    """

    if br_numbers:
        # Prevents SQL injection, this only calculates the placehoders ... i.e; BR_NMBR IN (%s, %s, %s)
        placeholders = ", ".join(["%s"] * len(br_numbers))
        base_query += f"""
        WHERE br.BR_NMBR IN ({placeholders});
        """
    return base_query
