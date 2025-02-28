from datetime import datetime
import pymssql
import json
import logging

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

    def execute_query(self, query, *args):
        """
        Executes a query against the database

        The returned content will always be in JSON format with items as column values
        """
        # Get the database connection
        conn = self.get_conn()
        cursor = conn.cursor()

        try:
            logger.debug("About to run this query %s", query)
            cursor.execute(query, args)
            rows = cursor.fetchall()

            # Fetch column names
            columns = [desc[0] for desc in cursor.description]
            print(columns)

            # Create a list of lists of dictionaries with one key-value pair each
            result = [[{columns[i]: row[i]} for i in range(len(columns))] for row in rows] # type: ignore

            # Convert the result to JSON
            json_result = json.dumps(result, default=_datetime_serializer, indent=4)

            # Log the result
            logger.debug(json_result)

            return json_result

        finally:
            # Ensure the connection is closed
            conn.close()

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")
