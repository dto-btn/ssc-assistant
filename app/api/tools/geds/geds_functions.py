import requests
import os
import json
import logging

from app.api.utils.decorators import tool_metadata

__all__ = ["get_employee_information"]

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

@tool_metadata({
  "type": "function",
  "tool_type": "geds",
  "function": {
    "name": "get_employee_information",
    "description": "Gets information on Government of Canada employee(s) by their name, it typically consists of a first name (given name) and last name (surname) of an employee, e.g. John Smith. Do NOT use this method unless you have been clearly asked by a user to provide contact information for a person and been provided with a full name.",
    "parameters": {
      "type": "object",
      "properties": {
        "employee_firstname": {
          "type": "string",
          "description": "The first name (given name) of an employee, e.g. John, Daniel, or Mary"
        },
        "employee_lastname": {
          "type": "string",
          "description": "The last name (surname) of an employee, e.g. Smith, Johnson, or Jones"
        }
      },
      "required": ["employee_lastname", "employee_firstname"]
    }
  }
})
def get_employee_information(employee_lastname: str = "", employee_firstname: str = ""):
    """
    get information about a specific employee
    """
    print(f"getting info for employee -> {employee_firstname} {employee_lastname}")
    # Check if the last name is provided, otherwise request it
    if not employee_lastname:
        return "Please provide a last name to search for an employee."

    # Check if the first name is provided
    if employee_firstname:
        search_value = f"{employee_lastname}%2C{employee_firstname}"
    else:
        search_value = employee_lastname

    url = (
        "https://api.geds-sage.gc.ca/gapi/v2/employees?"
        f"searchValue={search_value}&searchField=9&searchCriterion=2&searchScope=sub&searchFilter=2&maxEntries=5&pageNumber=1&returnOrganizationInformation=yes"
    )

    payload = {}
    api_token = os.getenv("GEDS_API_TOKEN")
    headers = {
        'X-3scale-proxy-secret-token': api_token,
        'Accept': 'application/json'
    }

    response = requests.request("GET", url, headers=headers, data=payload)

    # Check if the response was successful
    if response.status_code == 200:
        # Check if the response contains multiple employees with the same last name
        if len(json.loads(response.text)) > 1 and not employee_firstname:
            return "Found multiple employees with that last name. Please provide the first name as well. However, here are some of the first results: " + response.text
        
        # Check if the response contains multiple employees with the same first and last name
        elif len(json.loads(response.text)) > 1:
            return "Found multiple employees with that name. Return the phone number, name, and address for each employee, if available. Here are the results: " + response.text

        else:
            return "Found an employee with that name. Return the phone number, name, and address for the employee, if available" + response.text
    else:
        return "Didn't find any matching employee with that name."

def _get_employee_by_phone_number(employee_phone_number: str):
    """
    get information about a specific employee by phone number
    """
    print(f"getting info for employee with phone number-> {employee_phone_number}")
    # if phone number doesnt contain "-", add it
    if "-" not in employee_phone_number:
        employee_phone_number = employee_phone_number[:3] + "-" + employee_phone_number[3:6] + "-" + employee_phone_number[6:]

    url = (
        "https://api.geds-sage.gc.ca/gapi/v2/employees?"
        f"searchValue={employee_phone_number}&searchField=9&searchCriterion=2&searchScope=sub&searchFilter=2&maxEntries=5&pageNumber=1&returnOrganizationInformation=yes"
    )

    payload = {}
    api_token = os.getenv("GEDS_API_TOKEN")
    headers = {
        'X-3scale-proxy-secret-token': api_token,
        'Accept': 'application/json'
    }

    response = requests.request("GET", url, headers=headers, data=payload)

    # Check if the response was successful
    if response.status_code == 200:
        logger.debug(response)
        return json.dumps(response.text)
    else:
        logger.debug("Unable to get any info.", response)
        return "Didn't find any matching employee with that phone number."