import json
import logging
import os
from datetime import datetime

from tools.bits.bits_utils import DatabaseConnection
from utils.decorators import tool_metadata

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

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
    """gets br information"""
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

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")
