import json
import logging

from .archibus_functions import make_archibus_api_call
from .userprofile import user_profile
from utils.decorators import tool_metadata

logger = logging.getLogger(__name__)


@tool_metadata({
  "type": "function",
  "function": {
    "name": "get_employee_record",
    "description": "This function fetches detailed information about an employee based on their unique identifier. It returns a complex JSON object containing various employee attributes such as status, telework preferences, building assignment, and contact details.",
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
def get_employee_record():
  logger.debug("getting employee record")

  if user_profile.verify_profile():
    emId=user_profile.get_profile_data()['employee']['emId']
    if emId:
      payload = [
        {
          "fieldName": "em_id",
          "filterValue": emId,
          "filterOperation": "="
        }
      ]
      response = make_archibus_api_call(f"v1/data?viewName=ssc-common-def-em.axvw&dataSource=ab-common-def-em_grid_em", payload, 'GET')
      return json.loads(response.text)
    else:
      return False
  else:
     return False


