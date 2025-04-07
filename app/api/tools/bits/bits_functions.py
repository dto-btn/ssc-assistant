import json
import logging
import os
from typing import List, Optional

from src.constants.tools import TOOL_BR
from tools.bits.bits_utils import DatabaseConnection, extract_fields_from_query
from utils.decorators import (discover_subfolder_functions_with_metadata,
                              tool_metadata)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

db = DatabaseConnection(os.getenv("BITS_DB_SERVER", "missing.domain"),
                        os.getenv("BITS_DB_USERNAME", "missing.username"),
                        os.getenv("BITS_DB_PWD", "missing.password"),
                        os.getenv("BITS_DB_DATABASE", "missing.dbname"))

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
    'SR_OWNER': 'opis.SR_OWNER',
    'TEAMLEADER': 'opis.TEAMLEADER',
    'WIO_OPI': 'opis.WIO_OPI',
    'GCIT_CAT_EN': 'br.GCIT_CAT_EN',
    'GCIT_CAT_FR': 'br.GCIT_CAT_FR',
    'GCIT_PRIORITY_EN': 'br.GCIT_PRIORITY_EN',
    'GCIT_PRIORITY_FR': 'br.GCIT_PRIORITY_FR',
    'TARGET_IMPL_DATE': 'br.TARGET_IMPL_DATE',
}

opis_mapping = {
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
    "SR_OWNER": {
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

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_information",
        "description": "Returns Business Request(s) (BR) information. Can be invoked for one OR many BR numbers at the same time. I.e; Give me BR info for 12345, 32456 and 66123. Should only invoke this function once",
        "parameters": {
            "type": "object",
            "properties": {
                "br_numbers": {
                    "type": "array",
                    "description": "An Array containing all the Business Request (BR) numbers.",
                    "items": {
                        "type": "integer"
                    }
                }
            },
            "required": ["br_numbers"]
      }
    }
  })
def get_br_information(br_numbers: list[int]):
    """
    gets br information
    """
    query = _get_br_query(len(br_numbers))
    return db.execute_query(query, *br_numbers)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "search_br_by_fields",
        "description": "This function searches information about BRs given specific BR field(s) and value(s) pairs. YOU MUST ENSURE THAT YOU PASS THE FIELD NAMES AND THE VALUES IN THE SAME ORDER IN EACH RESPECTIVE LISTS.The fields available are: {fields}. If the user doesn't provide a `field_name` then let them know what the field names are. Otherwise use best guess.".replace("{fields}", ", ".join(list(valid_search_fields.keys()))),
        "parameters": {
            "type": "object",
            "properties": {
                "field_names": {
                    "type": "array",
                    "description": "A list of fields name(s) to filter BRs by.",
                    "items": {
                        "type": "string"
                    }
                },
                "field_values": {
                    "type": "array",
                    "description": "A list of fields value(s) to filter BRs by.",
                    "items": {
                        "type": "string"
                    }
                },
                "limit": {
                    "type": "integer",
                    "description": "The maximum number of BR items to return. Defaults to 100.",
                    "default": 100
                }
            },
            "required": ["field_names", "field_values"]
      }
    }
  })
def search_br_by_fields(field_names: List[str], field_values: List[str], limit: int = 100):
    """
    search_br_by_field

    Search BRs via a specific field:
    """
    if field_names:
        fields = extract_fields_from_query(field_names, list(valid_search_fields.keys()))
        print(fields)
        if fields:
            query_fields = [valid_search_fields[field] for field in fields]
            query = _get_br_query(limit=bool(limit), by_fields=query_fields)
            return db.execute_query(query, *(f"%{value}%" for value in field_values), limit)
    return "Try using one of the following fields: " + ", ".join(list(valid_search_fields.keys()))

@tool_metadata({
    "type": "function",
    "function": {
        "name": "how_to_search_brs",
        "description": "Use this function to help guide the user in their search for BRs. It will list all the functions here and their paremeter to help the AI guide the user in their search. If the question is asked in french please try to translate everything in french.",
        "parameters": {
            "type": "object",
            "properties": {},
            "required": []
      }
    }
  })
def how_to_search_brs():
    """
    This is a metadata function that will list all the functions
    here and their paremeter to help the AI guide the user in their search
    """
    functions = discover_subfolder_functions_with_metadata("tools.bits.bits_functions",
                                                           "tools/bits/bits_functions.py",
                                                           TOOL_BR)
    # filter out this function right here
    for key in list(functions.keys()):
        if key == "how_to_search_brs":
            del functions[key]

    metadata = {}
    for key, value in functions.items():
        metadata[key] = value['metadata']
    return json.dumps(metadata)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_statuses",
        "description": "Use this function to list all the BR Statuses. This can be used to get the STATUS_ID. To perform search in other queries.",
        "parameters": {
            "type": "object",
            "properties": {
                "active": {
                    "type": "boolean",
                    "description": "If true, only active statuses will be returned. Defaults to true."
                }
            },
            "required": []
      }
    }
  })
def get_br_statuses(active: bool = True):
    """
    This will retreive the code table BR_STATUSES
    """
    query = """
    SELECT STATUS_ID, BITS_STATUS_EN as NAME_EN, BITS_STATUS_FR as NAME_FR
    FROM EDR_CARZ.DIM_BITS_STATUS
    """

    if active:
        query += "WHERE BR_ACTIVE_EN = 'Active'"

    return db.execute_query(query, result_key="br_statuses")

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_br_by_status",
        "description": "Use this function to list all the BR filtered by a specific status.",
        "parameters": {
            "type": "object",
            "properties": {
                "status": {
                    "type": "string",
                    "description": "This is the status (STATUS_ID) that the user wants to filter the requests for. If you don't know the statuses beforehand call get_br_statuses() function to get STATUS_ID."
                },
                "limit": {
                    "type": "integer",
                    "description": "The maximum number of BR items to return. Defaults to 100.",
                    "default": 100
                },
                "assigned_to": {
                    "type": "string",
                    "description": "This is the name of the person that the BR is assigned to (BR_OWNER)"
                }
            },
            "required": ["status"]
      }
    }
  })
def get_br_by_status(status: str, assigned_to: str = "", limit: int = 100):
    """
    This will retreive BR filtered by status.
    """
    query = _get_br_query(status=True, limit=bool(limit))
    return db.execute_query(query, status, limit)

def _get_br_query(br_number_count: int = 0,
                    status: bool = False,
                    limit: bool = False,
                    active: bool = False,
                    by_fields: Optional[List[str]] = None) -> str:
    """Function that will build the select statement for retreiving BRs

    NOTE: No need to join on ORGANIZATION Table atm.. some info is already rolled in BR ITEMS ...
    """
    query = """WITH FilteredResults AS (
    SELECT
    """

    # Default select statement from BR_ITEMS & other tables
    query += "br.BR_NMBR as BR_NMBR, br.EXTRACTION_DATE as EXTRACTION_DATE, " + ", ".join([f"{value} as {key}" for key, value in valid_search_fields.items()])

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
            SR_OWNER,
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
