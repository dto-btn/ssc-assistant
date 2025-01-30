import json
import logging
import os
from datetime import datetime

#import pymssql
from utils.decorators import tool_metadata

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Define the connection string
server: str      = os.getenv("BITS_DB_SERVER", "missing.domain")
database: str    = os.getenv("BITS_DB_DATABASE", "missing.dbname")
username: str    = os.getenv("BITS_DB_USERNAME", "missing.username")
password: str    = os.getenv("BITS_DB_PWD", "missing.password")

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_information",
        "description": "Gets information about a BR given a specific BR number.",
        "parameters": {
            "type": "object",
            "properties": {
                "br_number": {
                    "type": "string",
                    "description": "A BR number."
                }
            },
            "required": ["br_number"]
      }
    }
  })
def get_br_information(br_number: str = ""):
    """gets br information"""
    # conn = pymssql.connect(server,username,password,database) # pylint: disable=no-member
    # cursor = conn.cursor()
    # # Define your query
    # query = f"SELECT * FROM EDR_CARZ.DIM_DEMAND_BR_ITEMS WHERE BR_NMBR = {br_number};"
    # # Execute the query
    # cursor.execute(query)
    # # Fetch all rows from the executed query
    # result = cursor.fetchall()
    # print(result)
    # json_result = json.dumps(result, default=_datetime_serializer, indent=4)
    # conn.close()
    # logger.debug(json_result)
    # return json_result
    return json.dumps({
        "br_number": br_number,
        "status": "success",
        "message": "This is a test message"
    }, default=_datetime_serializer, indent=4)

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")
