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
        query = """WITH FilteredResults AS (
        SELECT
        """

        # Default select statement from BR_ITEMS & other tables
        query += "br.BR_NMBR as BR_NMBR, br.EXTRACTION_DATE as EXTRACTION_DATE, " + ", ".join([f"{value} as {key}" for key, value in BRFields.valid_search_fields.items()])

        # Deault FROM statement
        query += """
        FROM
            [EDR_CARZ].[DIM_DEMAND_BR_ITEMS] br
        """

        # Processing BR SNAPSHOT clause
        #snapshot_where_clause = ["PERIOD_END_DATE > GETDATE()"]
        snapshot_where_clause = ["""
        PERIOD_END_DATE = (SELECT TOP(1) MAX(PERIOD_END_DATE) PERIOD_END_DATE FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT])
                                """]
        if status:
            placeholders = ", ".join(["%s"] * status)
            snapshot_where_clause.append(f"STATUS_ID IN ({placeholders})")

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

        # Processing BR OPIS clause
        query += """
        LEFT JOIN
            (SELECT
                BR_NMBR,
                ACC_MANAGER_OPI,
                AGR_OPI,
                BA_OPI,
                BA_PRICING_OPI,
                BA_PRICING_TL,
                BA_TL,
                CSM_DIRECTOR,
                EAOPI,
                PM_OPI,
                PROD_OPI,
                QA_OPI,
                SDM_TL_OPI,
                SISDOPI,
                SR_OWNER as BR_OWNER,
                TEAMLEADER,
                WIO_OPI
            FROM
            (
                SELECT opis.BR_NMBR, opis.BUS_OPI_ID, person.FULL_NAME
                FROM [EDR_CARZ].[FCT_DEMAND_BR_OPIS] opis
                INNER JOIN [EDR_CARZ].[DIM_BITS_PERSON] person
                ON opis.PERSON_ID = person.PERSON_ID
            ) AS SourceTable
            PIVOT
            (
                MAX(FULL_NAME)
                FOR BUS_OPI_ID IN (
                    ACC_MANAGER_OPI,
                    AGR_OPI,
                    BA_OPI,
                    BA_PRICING_OPI,
                    BA_PRICING_TL,
                    BA_TL,
                    CSM_DIRECTOR,
                    EAOPI,
                    PM_OPI,
                    PROD_OPI,
                    QA_OPI,
                    SDM_TL_OPI,
                    SISDOPI,
                    SR_OWNER,
                    TEAMLEADER,
                    WIO_OPI
                )
            ) AS PivotTable
        ) AS opis
        ON opis.BR_NMBR = br.BR_NMBR
        """

        # PRODUCTS
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
                if br_filter.is_date():
                    # Handle date fields
                    base_where_clause.append(f"CONVERT(DATE, {br_filter.name}) {br_filter.operator} %s")
                else:
                    # Handle other fields, defaulting to LIKE operator since they are mostly strings ...
                    base_where_clause.append(f"{br_filter.name} LIKE %s")

        if base_where_clause:
            query += "WHERE " + " AND ".join(base_where_clause)

        # Wrap CTE statement

        query += """)
        SELECT {top} *,
            (SELECT COUNT(*) FROM FilteredResults) AS TotalCount
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
