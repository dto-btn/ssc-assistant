import json
import logging
import time
from datetime import datetime
from typing import List, Optional

import pymssql

from tools.bits.bits_fields import BRFields
from tools.bits.bits_models import BRQueryFilter

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
                    'extraction_date': result[0].get("EXTRACTION_DATE") if result else None,
                }
            }

            # Convert the result to JSON
                                                    #needed for the date serialization
            json_result = json.dumps(final_result, default=_datetime_serializer, indent=4)
            return json.loads(json_result)

        finally:
            # Ensure the connection is closed
            conn.close()

class BRQueryBuilder:
    """Class to build BITS queries."""

    def get_br_query(self, br_number_count: int = 0,
                    status: int = 0,
                    limit: bool = False,
                    active: bool = True,
                    br_filters: Optional[List[BRQueryFilter]] = None) -> str:
        """Function that will build the select statement for retreiving BRs
        
        Parameters order for the execute query should be as follow:
        
        1) statuses
        2) all thw other fields value
        3) limit for TOP()
        
        """

        query = """
        DECLARE @MAX_DATE DATE = (SELECT MAX(PERIOD_END_DATE) FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT]);

        WITH FilteredResults AS (
        SELECT
        """

        # Default select statement from BR_ITEMS & other tables
        query += "br.BR_NMBR as BR_NMBR, br.EXTRACTION_DATE as EXTRACTION_DATE, " + ", ".join([f"{value['db_field']} as {key}" for key, value in BRFields.valid_search_fields.items()])

        # Default FROM statement
        query += """
        FROM
            [EDR_CARZ].[DIM_DEMAND_BR_ITEMS] br
        """

        # Processing BR SNAPSHOT clause
        snapshot_where_clause = ["snp.PERIOD_END_DATE = @MAX_DATE"]
        if status:
            placeholders = ", ".join(["%s"] * status)
            snapshot_where_clause.append(f"snp.STATUS_ID IN ({placeholders})")

        snapshot_where_clause = " AND ".join(snapshot_where_clause)
        query += f"""
        INNER JOIN
            [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT] snp
        ON snp.BR_NMBR = br.BR_NMBR AND {snapshot_where_clause}
        """

        # Processing BR STATUS clause
        query += """
        INNER JOIN
            [EDR_CARZ].[DIM_BITS_STATUS] s
        ON s.STATUS_ID = snp.STATUS_ID
        """

        # Processing BR OPIS clause - Using CASE statements instead of PIVOT
        query += """
        LEFT JOIN
            (SELECT
                BR_NMBR,
                MAX(CASE WHEN BUS_OPI_ID = 'ACC_MANAGER_OPI' THEN FULL_NAME END) AS ACC_MANAGER_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'AGR_OPI' THEN FULL_NAME END) AS AGR_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'BA_OPI' THEN FULL_NAME END) AS BA_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'BA_PRICING_OPI' THEN FULL_NAME END) AS BA_PRICING_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'BA_PRICING_TL' THEN FULL_NAME END) AS BA_PRICING_TL,
                MAX(CASE WHEN BUS_OPI_ID = 'BA_TL' THEN FULL_NAME END) AS BA_TL,
                MAX(CASE WHEN BUS_OPI_ID = 'CSM_DIRECTOR' THEN FULL_NAME END) AS CSM_DIRECTOR,
                MAX(CASE WHEN BUS_OPI_ID = 'EAOPI' THEN FULL_NAME END) AS EAOPI,
                MAX(CASE WHEN BUS_OPI_ID = 'PM_OPI' THEN FULL_NAME END) AS PM_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'PROD_OPI' THEN FULL_NAME END) AS PROD_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'QA_OPI' THEN FULL_NAME END) AS QA_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'SDM_TL_OPI' THEN FULL_NAME END) AS SDM_TL_OPI,
                MAX(CASE WHEN BUS_OPI_ID = 'SISDOPI' THEN FULL_NAME END) AS SISDOPI,
                MAX(CASE WHEN BUS_OPI_ID = 'SR_OWNER' THEN FULL_NAME END) AS BR_OWNER,
                MAX(CASE WHEN BUS_OPI_ID = 'TEAMLEADER' THEN FULL_NAME END) AS TEAMLEADER,
                MAX(CASE WHEN BUS_OPI_ID = 'WIO_OPI' THEN FULL_NAME END) AS WIO_OPI
            FROM (
                SELECT opis.BR_NMBR, opis.BUS_OPI_ID, person.FULL_NAME
                FROM [EDR_CARZ].[FCT_DEMAND_BR_OPIS] opis
                INNER JOIN [EDR_CARZ].[DIM_BITS_PERSON] person
                ON opis.PERSON_ID = person.PERSON_ID
            ) AS SourceTable
            GROUP BY BR_NMBR
        ) AS opis
        ON opis.BR_NMBR = br.BR_NMBR
        """

        # PRODUCTS - Optimized with filtering in the subquery
        query += """
        LEFT JOIN
            (SELECT BR_NMBR, PROD_ID FROM [EDR_CARZ].[FCT_DEMAND_BR_PRODUCTS] WHERE PROD_TYPE = 'LEAD') br_products
        ON br_products.BR_NMBR = br.BR_NMBR
        LEFT JOIN [EDR_CARZ].[DIM_BITS_PRODUCT] products ON products.PROD_ID = br_products.PROD_ID
        """

        # WHERE CLAUSE PROCESSING (BR_NMBR and ACTIVE, etc)
        base_where_clause = []
        if active:
            base_where_clause.append("s.BR_ACTIVE_EN = 'Active'")

        if br_number_count:
            # Prevents SQL injection, this only calculates the placehoders ... i.e; BR_NMBR IN (%s, %s, %s)
            placeholders = ", ".join(["%s"] * br_number_count)
            base_where_clause.append(f"br.BR_NMBR IN ({placeholders})")

        if br_filters:
            for br_filter in br_filters:
                field_name = BRFields.valid_search_fields.get(br_filter.name)
                if field_name:
                    if br_filter.is_date():
                        # Handle date fields
                        base_where_clause.append(f"CONVERT(DATE, {field_name['db_field']}) {br_filter.operator} %s")
                    else:
                        # Handle other fields, defaulting to LIKE operator since they are mostly strings ...
                        base_where_clause.append(f"{field_name['db_field']} LIKE %s")

        if base_where_clause:
            query += "WHERE " + " AND ".join(base_where_clause)

        # Wrap CTE statement
        query += """)
        SELECT {top} *,
            COUNT(*) OVER() AS TotalCount
        FROM FilteredResults
        """.replace("{top}", "TOP(%d)" if limit else "")

        # ORDER BY clause
        query += """
        ORDER BY
            BR_NMBR DESC
        """
        return query

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")
