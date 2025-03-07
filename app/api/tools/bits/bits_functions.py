import logging
import os
from typing import List, Optional

from tools.bits.bits_utils import DatabaseConnection, extract_fields_from_query
from utils.decorators import tool_metadata

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

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_information",
        "description": "Gets information about a BR given a specific BR number.",
        "parameters": {
            "type": "object",
            "properties": {
                "br_number": {
                    "type": "integer",
                    "description": "A BR number."
                }
            },
            "required": ["br_number"]
      }
    }
  })
def get_br_information(br_number: int):
    """
    gets br information

    SELECT BR_NMBR, BR_TITLE, BR_SHORT_TITLE, PRIORITY_EN, PRIORITY_FR, CLIENT_NAME_SRC, CREATE_DATE,
    SUBMIT_DATE, REQST_IMPL_DATE FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS WHERE BR_NMBR = 123456;
    """
    query = "SELECT * FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS WHERE BR_NMBR = %s;"
    return db.execute_query(query, br_number)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_updates",
        "description": "Gets BR updates from the snapshot table.",
        "parameters": {
            "type": "object",
            "properties": {
                "br_number": {
                    "type": "integer",
                    "description": "A BR number."
                },
                "top": {
                    "type": "integer",
                    "description": "The number of rows to return. Defaults to 5 if not specified."
                }
            },
            "required": ["br_number"]
      }
    }
  })
def get_br_updates(br_number: int, top: int = 5):
    """
    gets br updates from snapshot table
    """
    query = """
    SELECT
        TOP(%s)
        f.BR_NMBR,
        f.PERIOD_END_DATE,
        f.DAYS_SINCE_SUBMIT,
        f.LAST_STATUS_DATE,
        f.DAYS_IN_STATUS,
        f.AGE_IN_STATUS_EN,
        f.AGE_IN_STATUS_FR,
        f.IMPL_FLAG_EN,
        f.IMPL_FLAG_FR,
        d.BITS_STATUS_EN,
        d.BITS_STATUS_FR,
        d.BR_ACTIVE_EN,
        d.BR_ACTIVE_FR
    FROM
        [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT] f
    INNER JOIN
        [EDR_CARZ].[DIM_BITS_STATUS] d
    ON
        f.STATUS_ID = d.STATUS_ID
    WHERE
        f.BR_NMBR = %s
     ORDER BY f.LAST_STATUS_DATE DESC;"""
    return db.execute_query(query, top, br_number)

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
                    "description": "The maximum number of BR items to return. Defaults to 15.",
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

    query = f"""
    SELECT TOP(%d) *
    FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS
    WHERE {" OR ".join([f"{field} LIKE %s" for field in fields])};
    """

    name_pattern = f"{name}%"
    params = [limit] + [name_pattern] * len(fields)

    return db.execute_query(query, *params)
