import json
import logging
import os
from datetime import datetime

import requests
from utils.decorators import tool_metadata

logger = logging.getLogger(__name__)

__all__ = ["make_api_call",
           "get_user_bookings",
           "get_floors",
           "get_available_rooms",
           "get_floor_plan",
           "get_current_date"]

api_url = str(os.getenv("ARCHIBUS_API_URL", "http://archibusapi-dev.hnfpejbvhhbqenhy.canadacentral.azurecontainer.io/api/v1"))
api_username = str(os.getenv("ARCHIBUS_API_USERNAME"))
api_password = str(os.getenv("ARCHIBUS_API_PASSWORD"))

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


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_floors",
        "description": "Gets a list of the available floors in a building where a user can make a booking. If the user is attempting to make a booking and does not specify a floor, use this method to return a list of available floors to them and ask which floor they would like to book on before proceeding to any other functions. Do not use this method unless you have a buildingId. DO NOT USE A BUILDING NAME OR ADDRESS IN PLACE OF AN ID. Return the buildingId as well when you answer so you have it for later.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building where the booking takes place. Do not use the building name or address as the id"
                }
            },
            "required": ["buildingId"]
        }
    }
  })
def get_floors(buildingId: str):
    try:
        uri = f"/buildings/{buildingId}/floors"
        response = make_api_call(uri)
        response_json = json.loads(response.text)
        pretty_response = json.dumps(response_json, indent=4)
        logger.debug(pretty_response)
        logger.debug(f"Response status code: {response.status_code}")
        return response.json()  
    except requests.HTTPError as e:
        msg = f"An error occurred while trying to fetch floors for the building {buildingId}."
        logger.error(msg)
        return msg

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_available_rooms",
        "description": "Gets a list of all the vacant rooms or workspaces in a specified building and floor. Use this method once you have a buildingId, floorId, and date to retrieve a list of all the vacant rooms. IF YOU DONT HAVE A BUILDINGID, USE GET_BUILDINGS FUNCTION FIRST. DO NOT USE THE BUILDING ADDRESS OR NAME AS THE BUILDINGID. You should then present this list of rooms to the user and ask which room they would like to book.",
        "parameters": {
            "type": "object",
            "properties": {
            "buildingId": {
                "type": "string",
                "description": "A string indicating the ID of the building."
            },
            "floorId": {
                "type": "string",
                "description": "A string indicating the ID of the floor within the specified building."
            },
            "bookingDate": {
                "type": "string",
                "description": "A string indicating the date of the booking, including the month, day, and year, formatted like YYYY-MM-DD. The default year is 2024."
            }
            },
            "required": ["buildingId", "floorId", "bookingDate"]
        }
    }
  })
def get_available_rooms(buildingId: str, floorId: str, bookingDate: str):
    floor_plan_file_name = get_floor_plan(buildingId=buildingId, floorId=floorId)
    logger.debug(f"FILE NAME: {floor_plan_file_name}")

    try:
        uri = f"/reservations/buildings/{buildingId}/vacant/{floorId}?bookingDate={bookingDate}"
        response = make_api_call(uri)
        response_json = json.loads(response.text)
        filtered_rooms = response_json[:10]
        pretty_response = json.dumps(filtered_rooms, indent=4)

        logger.debug(pretty_response)
        logger.debug(f"Response status code: {response.status_code}")

        result = {
            "rooms": filtered_rooms
        }

        if floor_plan_file_name is not None:
            # base64_svg = base64.b64encode(floor_plan_blob).decode('utf-8')
            result["floorPlan"] = floor_plan_file_name

        return result
    except requests.HTTPError as e:
        msg = f"An error occurred while trying to fetch rooms for the given floor {floorId} and building {buildingId}."
        logger.error(msg)
        return msg


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_floor_plan",
        "description": "Retrieves the floor plan image associated with the selected floor from the user.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                "type": "string",
                "description": "A string indicating the ID of the building."
                },
                "floorId": {
                "type": "string",
                "description": "A string indicating the ID of the floor within the specified building."
                }
            },
            "required": ["floorId", "buildingId"]
        }
    }
  })
def get_floor_plan(buildingId: str, floorId: str):
    try:
        uri = f"/buildings/{buildingId}/floors"
        response = make_api_call(uri)
        response_json = json.loads(response.text)
        target_floor_blob_name = None

        for floor in response_json:
            if floor.get('flId') == floorId:
                target_floor_blob_name = floor.get('floorPlanURL')
                break

        if target_floor_blob_name:
            return target_floor_blob_name
        else:
            logger.error(f"Floor plan URL not found for floorId: {floorId}")
            return None

    except requests.HTTPError as e:
        msg = f"Error occurred during the request to retrieve floors: {e}"
        logger.error(msg)
        return msg
    
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

@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_current_date",
        "description": "This function is used to know what is the current date and time. It returns the current date and time in text format. Use this if you are unsure of what is the current date, do not make assumptions about the current date and time."
    }
  })
def get_current_date():
    """
    TODO: this perhaps should be moved into a more generic tools folder.
    """
    current_date_time = datetime.now()
    return "Formatted date and time:" + current_date_time.strftime("%Y-%m-%d %H:%M:%S")


def make_api_call(uri: str, payload=None) -> requests.Response:
    auth = (api_username, api_password)

    headers = {
        'Accept': 'application/json'
    }

    if payload:
        headers['Accept'] = '*/*'
        headers['Content-Type'] = 'application/json'
        response = requests.post(api_url + uri, headers=headers, auth=auth, data=payload)
    else:
        response = requests.get(api_url + uri, headers=headers, auth=auth)

    logger.debug(api_url + uri)
    response.raise_for_status()  # This will raise an HTTPError if the HTTP request returned an unsuccessful status code
    return response