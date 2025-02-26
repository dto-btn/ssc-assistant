import json
import logging
import os
from datetime import datetime

from tools.bits.bits_utils import DatabaseConnection
from utils.decorators import tool_metadata

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

db = DatabaseConnection(os.getenv("BITS_DB_SERVER", "missing.domain"),
                        os.getenv("BITS_DB_USERNAME", "missing.username"),
                        os.getenv("BITS_DB_PWD", "missing.password"),
                        os.getenv("BITS_DB_DATABASE", "missing.dbname"))

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

    SELECT BR_NMBR, BR_TITLE, BR_SHORT_TITLE, PRIORITY_EN, PRIORITY_FR, CLIENT_NAME_SRC, CREATE_DATE, SUBMIT_DATE, REQST_IMPL_DATE FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS WHERE BR_NMBR = 76193;
    """
    conn = db.get_conn()
    cursor = conn.cursor()
    # Define your query
    cursor.execute("SELECT * FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS WHERE BR_NMBR = %s;", br_number)
    # Fetch all rows from the executed query
    result = cursor.fetchall()
    json_result = json.dumps(result, default=_datetime_serializer, indent=4)
    conn.close()
    logger.debug(json_result)
    return json_result

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
                }
            },
            "required": ["br_number"]
      }
    }
  })
def get_br_updates(br_number: int):
    """
    gets br updates from snapshot table
    """
    conn = db.get_conn()
    cursor = conn.cursor()
    # Define your query
    cursor.execute("""
SELECT
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
        f.BR_NMBR = %s;""", br_number)
    # Fetch all rows from the executed query
    result = cursor.fetchall()
    json_result = json.dumps(result, default=_datetime_serializer, indent=4)
    conn.close()
    logger.debug(json_result)
    return json_result

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")
