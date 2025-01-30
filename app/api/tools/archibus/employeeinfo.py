import json
import logging
import requests
from .archibus_api_v1 import AzureAuthToken
from .api_helper import make_api_call

logger = logging.getLogger(__name__)
from utils.decorators import tool_metadata

@tool_metadata({
  "type": "function",
  "function": {
    "name": "get_employee_record",
    "description": "This function fetches detailed information about an employee based on their unique identifier. It returns a complex JSON object containing various employee attributes such as status, telework preferences, building assignment, and contact details.",
    "parameters": {
      "type": "object",
      "properties": {
        "employee_id": {
          "type": "string",
          "description": "The employee's unique ID, which is used to obtain their record from the API."
        }
      },
      "required": ["employee_id"]
    },
    "returns": {
      "type": "array",
      "description": "An array of JSON objects containing comprehensive information on the requested employee.",
      "items": {
        "type": "object",
        "properties": {
          "em.name": { "type": "string", "description": "The full name of the employee." },
          "em.em_current_status": { "type": "string", "description": "The current status of the employee." },
          "em.em_id.key": { "type": "string", "description": "A key identifier for the employee." },
          "em.fl_id": { "type": "string", "description": "The floor ID where the employee is located." },
          "em.em_ft_telework": { "type": "string", "description": "The telework status of the employee." },
          "dv.bu_id": { "type": "string", "description": "Business unit ID related to the employee's division." },
          "em.email": { "type": "string", "description": "The email address of the employee." },
          "bl.address1": { "type": "string", "description": "The primary address of the building." },
          "em.dv_id": { "type": "string", "description": "Division ID to which the employee belongs." },
          "em.dp_id":  { "type": "string", "description": "Department ID to which the employee belongs." },
          "em.classification": { "type": "string", "description": "Classification type of employee" },
          "em.honorific": { "type": "string", "description": "These can be titles prefixing a person's name" },
          "em.bl_id": { "type": "string", "description": "The unique identifier of the building" }
        }
      }
    }
  },
  "errors": [
    {
      "code": 400,
      "message": "Invalid employee ID format"
    },
    {
      "code": 404,
      "message": "Employee record not found"
    },
    {
      "code": 500,
      "message": "Internal server error"
    }
  ]
})
def get_employee_record(employee_id: str):
    logger.debug(f"Employee ID is: {employee_id}")

    if employee_id:
      token = AzureAuthToken()
      make_api_call(f"{AzureAuthToken.default_url}v1/user/{AzureAuthToken.user_id}")

    return [
    {
        "em.name": "Cody Robillard",
        "em.em_current_status": "YES",
        "em.em_id.key": "ROBILLARD, CODY",
        "em.fl_id": "T304",
        "em.em_ft_telework": "Fixed",
        "dv.bu_id": "08_EITP&CSB",
        "em.name_first": "Cody",
        "em.is_remote_worker": 0,
        "em.email": "cody.robillard@ssc-spc.gc.ca",
        "bl.address2": "Skyline Complex",
        "fl.occupancy_type": "OI",
        "bl.address1": "1285 & 1303 Baseline Road",
        "em.em_type": "TYPE 4",
        "em.em_id": "ROBILLARD, CODY",
        "em.name_last": "Robillard",
        "em.em_std": "NON EXEC",
        "em.dv_id": "08_CIO",
        "em.dp_id": "08_DES_BIS",
        "em.classification": "FTE",
        "em.honorific": "Mr",
        "em.bl_id": "HQ-BAS4"
    }
]