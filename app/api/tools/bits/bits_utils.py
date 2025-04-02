import json
import logging
import re
import time
from datetime import datetime

import pymssql

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

class DatabaseConnection:
    """Database connection class."""
    def __init__(self, server, username, password, database):
        self.server = server
        self.username = username
        self.password = password
        self.database = database

    def get_conn(self):
        """Get the database connection."""
        logger.debug("requesting connection to database to --> %s", self.server)
        return pymssql.connect(server=self.server, user=self.username, password=self.password, database=self.database)  # pylint: disable=no-member

    def execute_query(self, query, *args, result_key='br'):
        """
        Executes a query against the database

        The returned content will always be in JSON format with items as column values
        """
        # Get the database connection
        conn = self.get_conn()
        cursor = conn.cursor()

        try:
            logger.debug("About to run this query %s \nWith those params: %s", query, args)
            # Start timing the query execution
            start_time = time.time()

            cursor.execute(query, args)
            rows = cursor.fetchall()

            # End timing the query execution
            end_time = time.time()
            execution_time = end_time - start_time

            # Log the query execution time
            logger.info("Query executed in %s seconds", execution_time)

            # Fetch column names
            columns = [desc[0] for desc in cursor.description]

            # Create a list of lists of dictionaries with one key-value pair each
            #result = [[{columns[i]: row[i]} for i in range(len(columns))] for row in rows] # type: ignore
            result = [{columns[i]: row[i] for i in range(len(columns))} for row in rows] # type: ignore
            logger.debug("Found %s results!", len(result))

            total_count = next((item.get("TotalCount") for item in result if "TotalCount" in item), None)

            final_result = {
            result_key: result,
                'metadata': {
                    'execution_time': execution_time,
                    'results': len(result),
                    'total_rows': total_count,
                }
            }

            # Convert the result to JSON
                                                    #needed for the date serialization
            json_result = json.dumps(final_result, default=_datetime_serializer, indent=4)
            return json.loads(json_result)

        finally:
            # Ensure the connection is closed
            conn.close()

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def extract_fields_from_query(query: list, valid_fields: list):
    """
    Extract fields from the user's query based on the valid fields.

    Parameters:
        query (str): The user's query.
        valid_fields (list): A list of valid fields.

    Returns:
        list: A list of fields extracted from the query.
    """
    fields = []
    for user_field in query:
        # Check if the user_field matches any valid field
        for field in valid_fields:
            if re.search(rf"\b{field}\b", user_field, re.IGNORECASE):
                fields.append(user_field)
                break
    return fields
