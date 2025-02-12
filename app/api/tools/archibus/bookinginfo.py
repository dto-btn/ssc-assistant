import json
import logging
import requests

from utils.decorators import tool_metadata
from .api_helper import make_api_call, make_archibus_api_call
from .buildingInfo import get_floor_plan
from .userprofile import user_profile

logger = logging.getLogger(__name__)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_user_bookings",
        "description": "Gets a user's existing bookings in the archibus system by their first and last name. Do not use this method unless you have been asked to retrieve a user's bookings and have their first and last name",
        "parameters": {
            "type": "object",
            "properties": {
                "firstName": {
                    "type": "string",
                    "description": "A string indicating the first name of the user."
                },
                "lastName": {
                    "type": "string",
                    "description": "A string indicating the last name of the user."
                }
            },
            "required": ["firstName", "lastName"]
      }
    }
  })
def get_user_bookings(firstName: str = "", lastName: str = ""):
    if not firstName or not lastName:
        return "please provide a first and last name to search for a user's reservations"

    try:
        uri = f"/reservations/creator/{lastName.upper()},%20{firstName.upper()}"
        response = make_api_call(uri)
        filtered_response_json = json.loads(response.text)[-10:] # take last 10 items (API might be returning duplicates?)
        pretty_response = json.dumps(filtered_response_json, indent=4)
        logger.debug(f"Reservations: {pretty_response}")
        logger.debug(f"Response status code: {response.status_code}")
        return filtered_response_json

    except requests.HTTPError as e:
        msg = f"Unable to get user bookings (firstName: {firstName}, lastName: {lastName})"
        logger.error(msg)
        return msg

# @tool_metadata({
#     "type": "function",
#     "function": {
#         "name": "get_available_rooms",
#         "description": "Gets a list of all the vacant rooms or workspaces in a specified building and floor. Use this method once you have a buildingId, floorId, and date to retrieve a list of all the vacant rooms. IF YOU DONT HAVE A BUILDINGID, USE GET_BUILDINGS FUNCTION FIRST. DO NOT USE THE BUILDING ADDRESS OR NAME AS THE BUILDINGID. You should then present this list of rooms to the user and ask which room they would like to book.",
#         "parameters": {
#             "type": "object",
#             "properties": {
#             "buildingId": {
#                 "type": "string",
#                 "description": "A string indicating the ID of the building."
#             },
#             "floorId": {
#                 "type": "string",
#                 "description": "A string indicating the ID of the floor within the specified building."
#             },
#             "bookingDate": {
#                 "type": "string",
#                 "description": "A string indicating the date of the booking, including the month, day, and year, formatted like YYYY-MM-DD. The default year is 2024."
#             }
#             },
#             "required": ["buildingId", "floorId", "bookingDate"]
#         }
#     }
#   })
# def get_available_rooms(buildingId: str, floorId: str, bookingDate: str):
#     floor_plan_file_name = get_floor_plan(buildingId=buildingId, floorId=floorId)
#     logger.debug(f"FILE NAME: {floor_plan_file_name}")
#
#     try:
#         uri = f"/reservations/buildings/{buildingId}/vacant/{floorId}?bookingDate={bookingDate}"
#         response = make_api_call(uri)
#         response_json = json.loads(response.text)
#         filtered_rooms = response_json[:10]
#         pretty_response = json.dumps(filtered_rooms, indent=4)
#
#         logger.debug(pretty_response)
#         logger.debug(f"Response status code: {response.status_code}")
#
#         result = {
#             "rooms": filtered_rooms
#         }
#
#         if floor_plan_file_name is not None:
#             # base64_svg = base64.b64encode(floor_plan_blob).decode('utf-8')
#             result["floorPlan"] = floor_plan_file_name
#
#         return result
#     except requests.HTTPError as e:
#         msg = f"An error occurred while trying to fetch rooms for the given floor {floorId} and building {buildingId}."
#         logger.error(msg)
#         return msg


@tool_metadata({
  "type": "function",
  "function": {
    "name": "fetch_room_availability",
    "description": "Retrieves room availability data within a specified building and floor based on given date range and additional filters. It provides information about room occupancy, space availability, drawing names, and employee occupancy among other room attributes for space management tasks.",
    "parameters": [
      {
        "name": "date_start",
        "type": "string",
        "description": "The start date for the query range in 'YYYY-MM-DD' format."
      },
      {
        "name": "date_end",
        "type": "string",
        "description": "The end date for the query range in 'YYYY-MM-DD' format."
      },
      {
        "name": "dayPart",
        "type": "integer",
        "description": "Specifies the part of the day as an integer code to further narrow down the query results."
      },
      {
        "name": "emId",
        "type": "string",
        "description": "Employee identifier to filter the occupancy based on a specific employee's record."
      },
      {
        "name": "bl_id",
        "type": "string",
        "description": "Building identifier for which to fetch room availability."
      },
      {
        "name": "fl_id",
        "type": "string",
        "description": "Floor identifier for which to fetch room availability."
      },
      {
        "name": "rm_id",
        "type": "string",
        "description": "Optional room identifier for filtering to a specific room."
      },
      {
        "name": "rm_std",
        "type": "string",
        "description": "Standard of the room for additional filtering."
      },
      {
        "name": "rm_type",
        "type": "string",
        "description": "The type of room for additional filtering."
      },
      {
        "name": "dv_id",
        "type": "string",
        "description": "Division identifier to narrow down rooms by specific divisions."
      },
      {
        "name": "dp_id",
        "type": "string",
        "description": "Department identifier to narrow down rooms by specific departments."
      }
    ],
    "returns": {
      "type": "object",
      "description": "A JSON object structured in a list format containing detailed room availability records and associated data such as drawing names, floor available space, and building level occupancy details.",
      "properties": {
        "records": {
          "type": "array",
          "description": "A collection of rooms with their corresponding details and current availability statuses."
        },
        "fieldDefs": {
          "type": "array",
          "description": "Defines additional field details, if any."
        },
        "type": {
          "type": "string",
          "description": "Specifies the type of the data structure used in the result."
        },
        "version": {
          "type": "string",
          "description": "Indicates the version of the list data structure."
        },
        "hasMoreRecords": {
          "type": "boolean",
          "description": "A flag to check the presence of more records beyond the ones provided."
        }
      }
    }
  },
  "errors": [
    {
      "code": 400,
      "message": "Invalid or missing parameters in payload"
    },
    {
      "code": 404,
      "message": "No records found for the provided filter criteria"
    },
    {
      "code": 500,
      "message": "An error occurred while fetching room availability data"
    }
  ]
})
def fetch_room_availability(date_start, date_end, day_part, em_id, bl_id, fl_id,rm_id='', rm_std='', rm_type='', dv_id='', dp_id=''):
    if user_profile.verify_profile():
        payload = [
            "{\"date_start\": \"2025-02-11\", \"date_end\": \"2025-02-11\", \"dayPart\": 2, \"emId\": \"ROBILLARD, CODY\", \"bl_id\": \"HQ-BAS4\", \"fl_id\": \"T304\", \"rm_id\": \"\", \"rm_std\": \"\", \"rm_type\": \"\", \"dv_id\": \"\", \"dp_id\": \"\"}",
            "\"\""
        ]
        return {"records":[{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"225","n":"225"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"235","n":"235"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"242","n":"242"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"244","n":"244"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W001","n":"W001"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W002","n":"W002"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W003","n":"W003"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W004","n":"W004"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W005","n":"W005"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W006","n":"W006"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W007","n":"W007"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W008","n":"W008"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W009","n":"W009"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W010","n":"W010"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W011","n":"W011"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W012","n":"W012"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W013","n":"W013"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W014","n":"W014"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W015","n":"W015"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W016","n":"W016"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W017","n":"W017"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W018","n":"W018"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W019","n":"W019"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W020","n":"W020"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W021","n":"W021"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W022","n":"W022"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W023","n":"W023"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W033","n":"W033"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W034","n":"W034"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W035","n":"W035"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W036","n":"W036"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W037","n":"W037"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W038","n":"W038"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W039","n":"W039"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W040","n":"W040"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W042","n":"W042"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W043","n":"W043"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W044","n":"W044"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W045","n":"W045"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W046","n":"W046"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W047","n":"W047"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W048","n":"W048"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W049","n":"W049"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W050","n":"W050"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W051","n":"W051"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W052","n":"W052"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W053","n":"W053"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W054","n":"W054"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W055","n":"W055"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W056","n":"W056"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W057","n":"W057"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W058","n":"W058"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W059","n":"W059"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W060","n":"W060"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W081","n":"W081"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W082","n":"W082"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W083","n":"W083"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W084","n":"W084"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W085","n":"W085"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W086","n":"W086"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W087","n":"W087"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W088","n":"W088"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W090","n":"W090"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W092","n":"W092"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W093","n":"W093"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W094","n":"W094"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W095","n":"W095"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W096","n":"W096"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W097","n":"W097"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W098","n":"W098"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W099","n":"W099"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W100","n":"W100"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W101","n":"W101"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W102","n":"W102"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W103","n":"W103"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W104","n":"W104"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W105","n":"W105"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W106","n":"W106"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W107","n":"W107"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W108","n":"W108"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W109","n":"W109"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W110","n":"W110"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W111","n":"W111"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W112","n":"W112"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W113","n":"W113"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W114","n":"W114"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W115","n":"W115"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W116","n":"W116"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W117","n":"W117"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}},{"rm.dwgname":{"l":"SKY-T3-04-AFM","n":"SKY-T3-04-AFM"},"rm.fl_avail_space":{"l":"0","n":"0"},"rm.avail_space":{"l":"1","n":"1"},"rm.rm_id":{"l":"W118","n":"W118"},"rm.em_occupy":{"l":"0","n":"0"},"isNew":false,"rm.bl_fl":{"l":"HQ-BAS4-T304","n":"HQ-BAS4-T304"},"rm.cap_em":{"l":"1","n":"1"},"rm.bl_avail_space":{"l":"0","n":"0"},"rm.fl_id":{"l":"T304","n":"T304"},"rm.bl_id":{"l":"HQ-BAS4","n":"HQ-BAS4"}}],"fieldDefs":[],"type":"list","version":"2.0","hasMoreRecords":false}
        #response = make_archibus_api_call(f"v1/data?viewName=ssc-common-def-em.axvw&dataSource=ab-common-def-em_grid_em", payload, 'PUT')
    else:
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
              "buildingId": {
                  "type": "string",
                  "description": "The unique identifier of the building where the booking takes place. Example: AB-BAS4. DO NOT USE THE STREET NUMBER OR ADDRESS."
              },
              "floorId": {
                "type": "string",
                "description": "The unique identifier of the floor in the building that the user would like to make a booking on. Example: T404."
              },
              "roomId": {
                "type": "string",
                "description": "The identifier of the room in the building and on the given floor that the user would like to make a booking on. Example: W037."
              },
              "date": {
                  "type": "string",
                  "description": "The month, day, and year of the booking, formatted like YYYY-MM-DD. If the user does not provide a date, ask them for it. The year is 2024 unless otherwise specified."
              },
              "user": {
                "type": "string",
                "description": "The name for whom the booking is being made for, in the format 'lastname, firstname'. If the user doesn't provide a first and last name, ask them for it."
              },
              "bookingType": {
                "type": "string",
                "description": "The duration of the booking. Options are 'FULLDAY', 'AFTERNOON', and 'MORNING'."
              }
          },
          "required": ["date", "buildingId", "user", "duration", "floorId", "roomId"]
      }
    }
  })
def verify_booking_details(date: str, buildingId: str, user: str, bookingType: str, floorId: str, roomId: str):

    booking_details = {
        "createdBy": user,
        "assignedTo": user,
        "buildingId": buildingId,
        "floorId": floorId,
        "roomId": roomId,
        "bookingType": bookingType,
        "startDate": date
    }

    return booking_details