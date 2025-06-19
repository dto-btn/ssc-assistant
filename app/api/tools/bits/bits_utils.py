import json
import logging
import time
from datetime import datetime
from typing import List, Optional

import pymssql

from tools.bits.bits_fields import BRFields
from tools.bits.bits_models import BRQueryFilter, BRSelectFields

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

            extraction_date = result[0].get("EXTRACTION_DATE") if result else None
            total_count = result[0].get("TotalCount") if result else None

            # Remove both TotalCount and ExtractionDate from the result if they exist
            cleaned_result = [
                {k: v for k, v in item.items() if k not in ["TotalCount", "EXTRACTION_DATE", "BR_ACTIVE_EN", "BR_ACTIVE_FR"]}
                for item in result
            ]

            final_result = {
                result_key: cleaned_result,
                'metadata': {
                    'execution_time': execution_time,
                    'results': len(result),
                    'total_rows': total_count,
                    'extraction_date': extraction_date,
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

    # DEFAULT_SELECT_FIELDS_EN: BRSelectFields = BRSelectFields(fields=["BR_SHORT_TITLE",
    #             "RPT_GC_ORG_NAME_EN",
    #             "BITS_STATUS_EN",
    #             "BR_OWNER",
    #             "SUBMIT_DATE",])

    # DEFAULT_SELECT_FIELDS_FR: BRSelectFields = BRSelectFields(fields=["BR_SHORT_TITLE",
    #             "RPT_GC_ORG_NAME_FR",
    #             "BITS_STATUS_FR",
    #             "BR_OWNER",
    #             "SUBMIT_DATE",])
    def ensure_query_fields_present_in_select(self, br_filters: List[BRQueryFilter],
                                              select_fields: BRSelectFields) -> BRSelectFields:
        """Ensure that all fields in the BR filters are present in the select fields."""
        for br_filter in br_filters:
            if br_filter.name not in select_fields.fields:
                select_fields.fields.append(br_filter.name)
        return select_fields

    def get_br_query(self, br_number_count: int = 0,
                    limit: bool = False,
                    active: bool = True,
                    br_filters: Optional[List[BRQueryFilter]] = None,
                    select_fields: Optional[BRSelectFields] = None,
                    show_all: bool = False) -> str:
        """Function that will build the select statement for retreiving BRs
        
        Parameters order for the execute query should be as follow:
        
        1) statuses
        2) all thw other fields value
        3) limit for TOP()
        
        """

        query = """
        DECLARE @MAX_DATE DATETIME = (SELECT MAX(PERIOD_END_DATE) FROM [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT]);
        WITH
        """

        if show_all or (select_fields and any(field in select_fields.fields for field in ["LEAD_PRODUCT_EN", "LEAD_PRODUCT_FR", "PRODUCTS_EN", "PRODUCTS_FR"])):
            query += """
            ProductsList AS (
                SELECT 
                    BR_NMBR,
                    STRING_AGG(CASE WHEN br_products.PROD_TYPE != 'LEAD' THEN products.PROD_DESC_EN END, ', ') AS PRODUCTS_EN,
                    STRING_AGG(CASE WHEN br_products.PROD_TYPE != 'LEAD' THEN products.PROD_DESC_FR END, ', ') AS PRODUCTS_FR,
                    MAX(CASE WHEN br_products.PROD_TYPE = 'LEAD' THEN products.PROD_DESC_EN END) AS PROD_DESC_EN,
                    MAX(CASE WHEN br_products.PROD_TYPE = 'LEAD' THEN products.PROD_DESC_FR END) AS PROD_DESC_FR
                FROM [EDR_CARZ].[FCT_DEMAND_BR_PRODUCTS] br_products
                LEFT JOIN [EDR_CARZ].[DIM_BITS_PRODUCT] products WITH (NOLOCK)
                ON products.PROD_ID = br_products.PROD_ID
                GROUP BY BR_NMBR
            ),
            """

        query += """
        FilteredResults AS (
        SELECT
        """


        # Default select statement from BR_ITEMS & other tables
        query += """br.BR_NMBR as BR_NMBR,
                    br.EXTRACTION_DATE as EXTRACTION_DATE,
                    s.BR_ACTIVE_EN as BR_ACTIVE_EN,
                    s.BR_ACTIVE_FR as BR_ACTIVE_FR,
                    """

        if select_fields and not show_all:
            # Join only the fields specified in select_fields
            selected_fields = []
            for field_name in select_fields.fields:
                if field_name in BRFields.valid_search_fields:
                    field_info = BRFields.valid_search_fields[field_name]
                    selected_fields.append(f"{field_info['db_field']} as {field_name}")
            query += ", ".join(selected_fields)
        else:
            query += ", ".join([f"{value['db_field']} as {key}" for key, value in BRFields.valid_search_fields.items()])
        # Default FROM statement
        query += """
        FROM
            [EDR_CARZ].[DIM_DEMAND_BR_ITEMS] br
        """

        if show_all or active:
            # Processing BR SNAPSHOT clause
            query += """
            INNER JOIN
                [EDR_CARZ].[FCT_DEMAND_BR_SNAPSHOT] snp
            ON snp.BR_NMBR = br.BR_NMBR AND snp.PERIOD_END_DATE = @MAX_DATE
            """

            # Processing BR STATUS clause
            query += """
            INNER JOIN
                [EDR_CARZ].[DIM_BITS_STATUS] s
            ON s.STATUS_ID = snp.STATUS_ID
            """

        # Check if any user fields are included in select_fields or if show_all is True
        has_user_fields = show_all or (select_fields and any(
            field_name in BRFields.valid_search_fields and
            BRFields.valid_search_fields[field_name].get('is_user_field', False)
            for field_name in select_fields.fields
        ))

        # Processing BR OPIS clause - Only include if user fields are selected or show_all is True
        if has_user_fields:
            # Extract the selected user fields if select_fields is provided and show_all is False
            user_field_names = []
            if select_fields and not show_all:
                user_field_names = [field_name for field_name in select_fields.fields 
                                 if field_name in BRFields.valid_search_fields 
                                 and BRFields.valid_search_fields[field_name].get('is_user_field', False)]

            # If no specific user fields are selected but show_all is True, include all user fields
            if not user_field_names and show_all:
                user_field_names = [key for key, value in BRFields.valid_search_fields.items() 
                                  if value.get('is_user_field', False)]

            # Build the PIVOT fields dynamically from the selected user fields
            pivot_fields = []
            for field_name in user_field_names:
                # Extract the field ID from the db_field value (e.g., 'opis.BR_OWNER' -> 'BR_OWNER')
                field_id = BRFields.valid_search_fields[field_name]['db_field'].split('.')[1]
                # Add the BR_OWNER field if needed (special case since it's SR_OWNER in the database)
                if field_id != 'BR_OWNER':
                    pivot_fields.append(field_id)

            # Build the PIVOT list string
            pivot_list = ",\n".join(pivot_fields)
            if pivot_list:
                pivot_list = "," + pivot_list

            query += f"""
            LEFT JOIN
                (SELECT
                    BR_NMBR, SR_OWNER as BR_OWNER
                    {',' + ', '.join(pivot_fields) if pivot_fields else ''}
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
                    FOR BUS_OPI_ID IN ( SR_OWNER
                        {pivot_list}
                    )
                ) AS PivotTable
            ) AS opis
            ON opis.BR_NMBR = br.BR_NMBR
            """

        if show_all or (select_fields and any(field in select_fields.fields for field in ["LEAD_PRODUCT_EN", "LEAD_PRODUCT_FR", "PRODUCTS_EN", "PRODUCTS_FR"])):
            query += """
            LEFT JOIN ProductsList pl
            ON pl.BR_NMBR = br.BR_NMBR
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
                        _op = "LIKE" if br_filter.operator != '!=' else "NOT LIKE"
                        base_where_clause.append(f"{field_name['db_field']} {_op} %s")

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
        OPTION (RECOMPILE, OPTIMIZE FOR (@MAX_DATE UNKNOWN))
        """
        return query

def _datetime_serializer(obj):
    """JSON serializer for datetime objects."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")
