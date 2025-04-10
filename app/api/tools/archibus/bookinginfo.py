import json
import logging
from typing import List

import requests

from utils.decorators import tool_metadata
# from .api_helper import make_api_call, make_archibus_api_call
# from .buildingInfo import get_floor_plan
# from .userprofile import user_profile
from .archibus_utilities import get_current_date
logger = logging.getLogger(__name__)


def escape_quotes(s):
    return s.replace('"', '\\"')


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_historical_bookings",
        "description": "Fetches historical or previous bookings for a given employee ID for the past 2 months from the current date and never used for current bookings",
        "parameters": {
            "type": "object",
            "properties": {
                "em_id": {
                    "type": "string",
                    "description": "The employee ID for which historical bookings are to be fetched. if this is missing get it from employee record"
                }
            }
        },
        "required": ["em_id"]
    },
    "errors": [
        { "code": 400, "message": "Invalid input parameters" },
        { "code": 404, "message": "Historical bookings not found" },
        { "code": 500, "message": "Internal server error" }
    ]
})
def get_historical_bookings(em_id: str):
    from .api_helper import make_archibus_api_call
    from .userprofile import user_profile
    from .archibus_utilities import get_current_date, get_date_two_months_ago

    if user_profile.verify_profile():
        date_start = get_date_two_months_ago()
        date_end = get_current_date()
        if em_id is None:
            em_id = user_profile.get_user_id()
        payload = [
            {
                "fieldName": "em_id",
                "filterValue": em_id,
                "filterOperation": "="
            },
            {
                "fieldName": "date_start",
                "filterValue": date_start,
                "filterOperation": ">="
            },
            {
                "fieldName": "date_end",
                "filterValue": date_end,
                "filterOperation": "<="
            },

        ]
        response = make_archibus_api_call(f"v1/data?viewName=ssc-system-util.axvw&dataSource=historical_booking_ds", payload, 'GET')
        return json.loads(response.text)
    else:
        return False

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_current_reservations",
        "description": "Retrieves a list of current reservations for a given employee ID by calling an API endpoint that returns a JSON array of reservations.",
        "parameters": {
            "type": "object",
            "properties": {
                "em_id": {
                    "type": "string",
                    "description": "The employee ID for whom the current reservations are to be fetched. if this missing get this from employee record"
                }
            }
        },
        "returns": {
            "type": "array",
            "description": "A JSON array containing current reservations for the specified employee."
        },
        "required": ["em_id"]
    },
    "errors": [
        { "code": 400, "message": "Invalid input em_id" },
        { "code": 404, "message": "Reservations not found for the specified employee" },
        { "code": 500, "message": "Internal server error" }
    ]
})
def get_current_reservations(em_id: str):
    from .api_helper import  make_archibus_api_call
    from .userprofile import user_profile

    if user_profile.verify_profile():
        if em_id is None:
            em_id = user_profile.get_user_id()
        start_date = get_current_date()
        payload = [
            {
                "fieldName": "em_id",
                "filterValue": em_id,
                "filterOperation": "="
            },
            {
                "fieldName": "date_start",
                "filterValue": start_date,
                "filterOperation": "="
            },

        ]
        response = make_archibus_api_call(f"v1/data?viewName=ab-selfservice-dashboard.axvw&dataSource=workplaceReservations", payload, 'GET')
        return json.loads(response.text)
    else:
        return False

@tool_metadata({
    "type": "function",
    "function": {
        "name": "create_users_booking",
        "description": "Creates a booking entry in an Archibus system with the provided booking details. only do this after confirming with the user that booking details are correct never any other time.for multiple days you will have to run this for each individual day",
        "parameters": {
            "type": "object",
            "properties": {
                "bl_id": {
                    "type": "string",
                    "description": "The building ID for the booking. get the bl_id from employee record if not provided is not the building address and should look something like 'HQ-BAS4'"
                },
                "fl_id": {
                    "type": "string",
                    "description": "The floor ID for the booking. get this from employee record if not provided"
                },
                "rm_id": {
                    "type": "string",
                    "description": "The room ID for the booking. pick the first available room from fetch_room_availability if not provided"
                },
                "em_id": {
                    "type": "string",
                    "description": "The employee ID associated with the booking it often the lastname, firstname. get from employee record. example 'EINSTEIN, ALBERT'"
                },
                "dv_id": {
                    "type": "string",
                    "description": "The division ID relevant to the booking. get from employee record if not provided. example of one is '08_CIO.'"
                },
                "dp_id": {
                    "type": "string",
                    "description": "The department ID relevant to the booking. get from employee record if not provided. example of one is '08_DES_BIS'"
                },
                "start_date": {
                    "type": "string",
                    "format": "date",
                    "description": "The start date of the booking, formatted as 'YYYY-MM-DD'. leave blank if you are unsure this date can not be in the past"
                },
                "dayPart": {
                    "type": "string",
                    "description": "This indicated a full day with 0, the morning half day with 1 and afternoon half day with 2 example: 0:Full Day / 1:Morning / 2:Afternoon"
                }
            },
            "required": ["bl_id", "fl_id", "rm_id", "em_id", "dv_id", "dp_id","start_date", "daysPart",]
        },
        "returns": {
            "description": "A JSON object with the response from the Archibus system. If the status code is 200, the booking was successful.",
            "type": "object"
        }
    }
})
def create_users_booking( bl_id: str, fl_id: str, rm_id: str, em_id: str, dv_id: str, dp_id: str, start_date: str = None, dayPart: str = 0) :
    from .api_helper import  make_archibus_api_call
    from .userprofile import user_profile

    if start_date is None:
        start_date = get_current_date()

    if start_date < get_current_date():
        return {"invalid date, date is in past"}

    if user_profile.verify_profile():
        bookingRecord = [
            {
                "values":
                        {
                            "rmpct.bl_id": bl_id,
                            "rmpct.fl_id": fl_id,
                            "rmpct.rm_id": rm_id,
                            "rmpct.em_id": em_id,
                            "rmpct.dv_id": dv_id,
                            "rmpct.dp_id": dp_id,
                            "rmpct.confirmed": "0"
                        }
            }
        ]

        param = [
            "\"\"",
            "\"\"",
            dayPart,
            start_date,
            start_date,
            "\"\"",
            [
                json.dumps(bookingRecord[0], separators=(',', ':')),  # Ensures no extra spaces
            ]
        ]

        if param is not None:
            response = make_archibus_api_call(
                f"v1/workflowrule/callWorkflowRuleMethod/AbEssentialFacility-HotelingHandler-createBookings", param,
                'PUT')
            return json.loads(response.text)
        else:
            return False
    else:
        return False


@tool_metadata({
    "type": "function",
    "function": {
        "name": "fetch_room_availability",
        "description": "Gets a list of all the vacant rooms or workspaces in a specified building and floor. Use this method once you have a buildingId, floorId, and date to retrieve a list of all the vacant rooms. Any missing data use the employee record to get the building and floor information and use the current date for the date if missing. You should then present this list of rooms to the user and ask which room they would like to book. If any dates are missing, use the current date.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "A string indicating the ID of the building. Get from the employee record if missing."
                },
                "floorId": {
                    "type": "string",
                    "description": "A string indicating the ID of the floor within the specified building. Get from the employee record if missing or ask the user."
                },
                "date_start": {
                    "type": "string",
                    "description": "A string indicating the start date of the booking, including the month, day, and year, formatted as YYYY-MM-DD. Use the current date if missing; it cannot be a date from the past."
                },
                "date_end": {
                    "type": "string",
                    "description": "A string indicating the end date of the booking, including the month, day, and year, formatted as YYYY-MM-DD. Use the current date if missing; it cannot be a date from the past."
                },
                "dayPart": {
                    "type": "string",
                    "description": "This indicated a full day with 0, the morning half day with 1 and afternoon half day with 2 example: 0:Full Day / 1:Morning / 2:Afternoon"
                }
            }
        },
        "returns": {
            "type": "object",
            "description": "A JSON object containing information about the available rooms.",
            "properties": {
                "jsonExpression": {
                    "type": "string",
                    "description": "A JSON string representing the list of available rooms and their details."
                }
            }
        },
        "required": ["buildingId", "floorId", "date_start", "date_end", "dayPart"]
    }
})
def fetch_room_availability(buildingId: str, floorId: str, date_start: str = None, date_end: str = None, dayPart: str = 0):
    from .api_helper import make_archibus_api_call
    from .userprofile import user_profile

    if date_start is None:
        date_start = get_current_date()
    if date_end is None:
        date_end = get_current_date()

    if user_profile.verify_profile():

        data_list =[
            {
                "date_start": date_start,
                "date_end":date_end,
                "dayPart":dayPart,
                "emId":"",
                "bl_id": buildingId,
                "fl_id": floorId,
                "rm_id": "",
                "rm_std":"",
                "rm_type":"",
                "dv_id":"",
                "dp_id":"",
            },
            {}
        ]

        payload = [
            json.dumps(data_list[0], separators=(',', ':')),  # Ensures no extra spaces
            "\"\""  # This ensures that the second element is exactly "\"\""
        ]

        response =  make_archibus_api_call(f"v1/workflowrule/callWorkflowRuleMethod/AbEssentialFacility-HotelingHandler-searchAvailableSpaces", payload, 'PUT')
        return json.loads(response.text)
    else:
        return False


@tool_metadata({
    "type": "function",
    "function": {
        "name": "fetch_first_available_room",
        "description": "Gets the first available vacant room or workspaces in a specified building and floor. Any missing data use the employee record to get the building and floor information and use the current date for the date if missing. Use this to supply a room if one is not provided",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "A string indicating the ID of the building. Get from the employee record if missing."
                },
                "floorId": {
                    "type": "string",
                    "description": "A string indicating the ID of the floor within the specified building. Get from the employee record if missing."
                },
                "date_start": {
                    "type": "string",
                    "description": "A string indicating the start date of the booking, including the month, day, and year, formatted as YYYY-MM-DD. Use the current date if missing; it cannot be a date from the past."
                },
                "date_end": {
                    "type": "string",
                    "description": "A string indicating the end date of the booking, including the month, day, and year, formatted as YYYY-MM-DD. Use the current date if missing; it cannot be a date from the past."
                },
                "dayPart": {
                    "type": "string",
                    "description": "This indicated a full day with 0, the morning half day with 1 and afternoon half day with 2 example: 0:Full Day / 1:Morning / 2:Afternoon"
                }
            }
        },
        "returns": {
            "type": "object",
            "description": "A JSON object containing first available room.",
            "properties": {
                "jsonExpression": {
                    "type": "string",
                    "description": "A JSON string representing the first available room and it's details."
                }
            }
        },
        "required": ["buildingId", "floorId", "date_start", "date_end", "dayPart"]
    }
})
def fetch_first_available_room(buildingId: str, floorId: str, date_start: str = get_current_date(), date_end: str = get_current_date(), dayPart: str = 0):
    from .userprofile import user_profile

    if user_profile.verify_profile():
        response = fetch_room_availability(buildingId, floorId, date_start, date_end, dayPart)

        # Convert the JSON string into a Python dictionary
        json_data = json.loads(response['jsonExpression'])

        # Access the "records" key and get the first record
        first_record = json_data['records'][0]
        return first_record
    else:
        return False



@tool_metadata({
    "type": "function",
    "function": {
        "name": "cancel_bookings",
        "description": "Cancels bookings from the reservation system. If any of fields are missing retrieves it current reservations using the 'get_current_reservations' function to find the relevant booking data to cancel. Do not cancel before confirming that one your going cancel is the correct one",
        "parameters": {
            "type": "object",
            "properties": {
                "pct_id": {
                    "type": "integer",
                    "description": "The ID of the specific portion of the booking to be canceled. If missing, retrieved from the 'get_current_reservations' field rmpct.pct_id."
                },
                "parent_pct_id": {
                    "type": "integer",
                    "description": "The ID of the parent portion of booking if applicable. If missing, retrieved from the 'get_current_reservations' field rmpct.parent_pct_id."
                },
                "em_id": {
                    "type": "string",
                    "description": "The ID of the employee who made the booking. If missing, retrieved from the 'get_current_reservations' field rmpct.em_id."
                },
                "bl_id": {
                    "type": "string",
                    "description": "The ID of the building where the booking should be canceled. If missing, retrieved from the 'get_current_reservations' field rmpct.bl_id."
                },
                "activity_log_id": {
                    "type": "string",
                    "description": "The ID of the activity. If missing, retrieved from the 'get_current_reservations' field rmpct.activity_log_id."
                },
                "vistorID": {
                    "type": "string",
                    "description": "The ID of the visitor for whom the booking was made"
                },
                "operationLevel": {
                    "type": "string",
                    "description": "The level of operation at which the booking needs to be canceled. If missing, retrieved from the 'get_current_reservations' results."
                },
            }
        },
        "required": ["pct_id","parentPctId","emID","blID","activity_log_id"]
    }
})
def cancel_bookings(pct_id: int, parent_pct_id: int, em_id: str, bl_id: str, activity_log_id: str, vistorID: str = None, operationLevel: str = "1"):
    from .api_helper import make_archibus_api_call
    from .userprofile import user_profile

    if user_profile.verify_profile():
        if pct_id and parent_pct_id and em_id and bl_id and activity_log_id is not None:
            payload =     [
              operationLevel,
              [pct_id],
              parent_pct_id,
              [em_id],
              ["\"\""],
              [bl_id],
              [activity_log_id]
            ]
            response = make_archibus_api_call(f"v1/workflowrule/callWorkflowRuleMethod/AbEssentialFacility-HotelingHandler-cancelBookings", payload,'PUT')
            return json.loads(response.text)
        else:
            return False
    return False

@tool_metadata({
    "type": "function",
    "tool_type": "archibus",
    "function": {
      "name": "verify_booking_details",
      "description": "Confirms the workspace or meeting space booking details with the user. You are not making the booking for them. This function should be used after all the necessary information has been acquired, including the buildingId, floorId, roomId, date, first AND last name, and duration. ",
      "parameters": {
        "type": "object",
          "properties": {
              "date_start": {
                  "type": "string",
                  "description": "The month, day, and year of the booking, formatted like YYYY-MM-DD. If the user does not provide a date, ask them for it."
              },
              "bl_id": {
                  "type": "string",
                  "description": "The unique identifier of the building where the booking takes place. Example: AB-BAS4. DO NOT USE THE STREET NUMBER OR ADDRESS."
              },
              "fl_id": {
                "type": "string",
                "description": "The unique identifier of the floor in the building that the user would like to make a booking on. Example: T404."
              },
              "rm_id": {
                "type": "string",
                "description": "The identifier of the room in the building and on the given floor that the user would like to make a booking on. Example: W037."
              },

              "em_id": {
                "type": "string",
                "description": "The name for whom the booking is being made for, in the format 'lastname, firstname'. If the user doesn't provide a first and last name, ask them for it."
              },
              "dayPart": {
                "type": "string",
                "description": "This indicated a full day with 0, the morning half day with 1 and afternoon half day with 2 example: 0:Full Day / 1:Morning / 2:Afternoon"
              }
          },
          "required": ["date_start", "buildingId", "user", "duration", "floorId", "roomId"]
      }
    }
  })
def verify_booking_details(date_start: str, bl_id: str, fl_id: str, rm_id: str, em_id: str, dayPart: int ):

    booking_details = {
        "date_start":date_start,
        "date_end":date_start,
        "bl_id":bl_id,
        "fl_id":fl_id,
        "rm_id":rm_id,
        "em_id":em_id,
        "dayPart":dayPart
    }

    return booking_details





