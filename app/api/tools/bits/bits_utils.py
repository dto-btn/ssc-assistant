import json
import logging
import re
import time
from datetime import datetime
from typing import List, Optional

import pymssql

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

_opis_mapping = {
    "QA_OPI": {
        "en": "QA OPI",
        "fr": "BPR QA"
    },
    "CSM_DIRECTOR": {
        "en": "Client Executive",
        "fr": "Client exécutif"
    },
    "PROD_OPI": {
        "en": "Service Lead",
        "fr": "BPR des services"
    },
    "ENG_OPI": {
        "en": "Implementation OPI",
        "fr": "BPR Implémentation"
    },
    "BA_OPI": {
        "en": "BA OPI",
        "fr": "BPR analyste"
    },
    "TEAMLEADER": {
        "en": "Teamleader",
        "fr": "Chef d`équipe"
    },
    "BA_PRICING_OPI": {
        "en": "BA Pricing OPI",
        "fr": "BPR AA du prix"
    },
    "BA_PRICING_TL": {
        "en": "Service Line Coordinator",
        "fr": "Coordonnateur de la ligne de service"
    },
    "BR_OWNER": {
        "en": "BR OWNER",
        "fr": "Propriétaire"
    },
    "WIO_OPI": {
        "en": "Finance OPI",
        "fr": "BPR du Finance"
    },
    "EAOPI": {
        "en": "EA OPI",
        "fr": "BPR AE"
    },
    "SOLN_OPI": {
        "en": "Conceptual Designer",
        "fr": "Créateur Conceptuel"
    },
    "AGR_OPI": {
        "en": "Agreement OPI",
        "fr": "BPR Entente"
    },
    "PM_OPI": {
        "en": "PM/Coordinator",
        "fr": "GP/Coordonnateur"
    },
    "SISDOPI": {
        "en": "SISD OPI",
        "fr": "BPR DSIS"
    },
    "BA_TL": {
        "en": "BA Team Lead",
        "fr": "Chef d`équipe analystes"
    },
    "ACC_MANAGER_OPI": {
        "en": "Account Manager",
        "fr": "Gestionnaire de compte"
    },
    "SDM_TL_OPI": {
        "en": "SDM Team Lead",
        "fr": "GPS Chef d'équipe"
    }
}

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

class BITSQueryBuilder:
    """Class to build BITS queries."""

    valid_search_fields = {
        'LEAD_PRODUCT': 'products.PROD_ID',
        'BR_SHORT_TITLE': 'br.BR_SHORT_TITLE',
        'RPT_GC_ORG_NAME_EN': 'br.RPT_GC_ORG_NAME_EN',
        'RPT_GC_ORG_NAME_FR': 'br.RPT_GC_ORG_NAME_FR',
        'ORG_TYPE_EN': 'br.ORG_TYPE_EN',
        'ORG_TYPE_FR': 'br.ORG_TYPE_FR',
        'REQST_IMPL_DATE': 'br.REQST_IMPL_DATE',
        'BR_TYPE_EN': 'br.BR_TYPE_EN',
        'BR_TYPE_FR': 'br.BR_TYPE_FR',
        'PRIORITY_EN': 'br.PRIORITY_EN',
        'PRIORITY_FR': 'br.PRIORITY_FR',
        'SUBMIT_DATE': 'br.SUBMIT_DATE',
        'RVSD_TARGET_IMPL_DATE': 'br.RVSD_TARGET_IMPL_DATE',
        'CPLX_EN': 'br.CPLX_EN',
        'CPLX_FR': 'br.CPLX_FR',
        'ACTUAL_IMPL_DATE': 'br.ACTUAL_IMPL_DATE',
        'AGRMT_END_DATE': 'br.AGRMT_END_DATE',
        'SCOPE_EN': 'br.SCOPE_EN',
        'SCOPE_FR': 'br.SCOPE_FR',
        'CLIENT_REQST_SOL_DATE': 'br.CLIENT_REQST_SOL_DATE',
        'CLIENT_SUBGRP_EN': 'br.CLIENT_SUBGRP_EN',
        'CLIENT_SUBGRP_FR': 'br.CLIENT_SUBGRP_FR',
        'PRPO_TARGET_DATE': 'br.PRPO_TARGET_DATE',
        'IMPL_SGNOFF_DATE': 'br.IMPL_SGNOFF_DATE',
        'GROUP_EN': 'br.GROUP_EN',
        'GROUP_FR': 'br.GROUP_FR',
        'ASSOC_BRS': 'br.ASSOC_BRS',
        'BR_ACTIVE_EN': 's.BR_ACTIVE_EN',
        'BR_ACTIVE_FR': 's.BR_ACTIVE_FR',
        'BITS_STATUS_EN': 's.BITS_STATUS_EN',
        'BITS_STATUS_FR': 's.BITS_STATUS_FR',
        'ACC_MANAGER_OPI': 'opis.ACC_MANAGER_OPI',
        'AGR_OPI': 'opis.AGR_OPI',
        'BA_OPI': 'opis.BA_OPI',
        'BA_PRICING_OPI': 'opis.BA_PRICING_OPI',
        'BA_PRICING_TL': 'opis.BA_PRICING_TL',
        'BA_TL': 'opis.BA_TL',
        'CSM_DIRECTOR': 'opis.CSM_DIRECTOR',
        'EAOPI': 'opis.EAOPI',
        'PM_OPI': 'opis.PM_OPI',
        'QA_OPI': 'opis.QA_OPI',
        'SDM_TL_OPI': 'opis.SDM_TL_OPI',
        'BR_OWNER': 'opis.BR_OWNER',
        'TEAMLEADER': 'opis.TEAMLEADER',
        'WIO_OPI': 'opis.WIO_OPI',
        'GCIT_CAT_EN': 'br.GCIT_CAT_EN',
        'GCIT_CAT_FR': 'br.GCIT_CAT_FR',
        'GCIT_PRIORITY_EN': 'br.GCIT_PRIORITY_EN',
        'GCIT_PRIORITY_FR': 'br.GCIT_PRIORITY_FR',
        'TARGET_IMPL_DATE': 'br.TARGET_IMPL_DATE',
    }

    def get_br_query(self, br_number_count: int = 0,
                    status: bool = False,
                    limit: bool = False,
                    active: bool = True,
                    by_fields: Optional[List[str]] = None) -> str:
        """Function that will build the select statement for retreiving BRs

        NOTE: No need to join on ORGANIZATION Table atm.. some info is already rolled in BR ITEMS ...
        """
        query = """WITH FilteredResults AS (
        SELECT
        """

        # Default select statement from BR_ITEMS & other tables
        query += "br.BR_NMBR as BR_NMBR, br.EXTRACTION_DATE as EXTRACTION_DATE, " + ", ".join([f"{value} as {key}" for key, value in self.valid_search_fields.items()])

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
            snapshot_where_clause.append("STATUS_ID IN (%s)")

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
        INNER JOIN
            (SELECT BR_NMBR, PROD_ID FROM [EDR_CARZ].[FCT_DEMAND_BR_PRODUCTS] WHERE PROD_TYPE = 'LEAD') products
        ON products.BR_NMBR = br.BR_NMBR
        """

        # WHERE CLAUSE PROCESSING (BR_NMBR and ACTIVE, etc)
        base_where_clause = []
        if active:
            base_where_clause.append("s.BR_ACTIVE_EN = 'Active'")

        if br_number_count:
            # Prevents SQL injection, this only calculates the placehoders ... i.e; BR_NMBR IN (%s, %s, %s)
            placeholders = ", ".join(["%s"] * br_number_count)
            base_where_clause.append(f"br.BR_NMBR IN ({placeholders})")

        if by_fields:
            base_where_clause.append(" AND ".join([f"{field} LIKE %s" for field in by_fields]))

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
