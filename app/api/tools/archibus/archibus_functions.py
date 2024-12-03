from datetime import datetime
import requests
import os
import json
import logging

from utils.decorators import tool_metadata
from win32comext.shell.demos.servers.folder_view import debug

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)

__all__ = ["make_api_call", "get_user_bookings", "get_floors", "get_available_rooms", "get_floor_plan", "get_current_date", "book_first_available_room", "book_specific_room", "create_repeat_booking"]

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


@tool_metadata({
    "type": "function",
    "function": {
        "name": "book_first_available_room",
        "description": "Books the first available room if no other information is provided.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "Optional: A string indicating the ID of the desired building."
                },
                "floorId": {
                    "type": "string",
                    "description": "Optional: A string indicating the ID of the desired floor within the building. If not provided, the user will be prompted."
                },
                "bookingDate": {
                    "type": "string",
                    "description": "Optional: The date of the booking, formatted like YYYY-MM-DD."
                }
            }
        }
    }
})
def book_first_available_room(buildingId: str = None, floorId: str = None, bookingDate: str = None):

    #TODO get user login from active directory
    userID = dummy_get_user()#dummy user
    #logger.debug(userID)

    buildingId = "HQ-BAS4"
    #logger.debug(buildingId)

    available_floors = get_floors(buildingId)
    #logger.debug(available_floors)
    floorId = available_floors[0]["flId"]
    #logger.debug(f"Floor ID: {floorId}")

    bookingDate = datetime.now().strftime("%Y-%m-%d")
    #logger.debug(f"Booking Date: {bookingDate}")

    available_rooms = get_available_rooms(buildingId, floorId, bookingDate)
    #logger.debug(f"Available Rooms: {available_rooms}")
    roomId = available_rooms['rooms'][0]['roomId']
    #logger.debug(f"Room ID: {roomId}")

    bookingType = "FULLDAY"

    #TODO need to making the booking_details and return it
    booking_details = verify_booking_details(bookingDate, buildingId, userID,bookingType, floorId, roomId, )
    logger.debug(f"Booking Details: {booking_details}")
    logger.debug(f"Reservations: IT'S WORKING")

    return


# DUMMY DATA
def dummy_get_user_building_selection():
    # Mockup function to simulate user selecting a building ID.
    # In a real application, this would be replaced by the actual user input from frontend or chatbot interface.
    # In this example, we will just return a sample response:
    return {
        'selectedBuildingId': 'HQ-BAS4'  # Replace with actual building ID from user selection.
    }

def dummy_get_user():
    return {
        "selectedUserId": "CODY.ROBILLARD@SSC-SPC.GC.CA"
    }


@tool_metadata({
    "type": "function",
    "tool_type": "archibus",
    "function": {
        "name": "book_specific_room",
        "description": "Books a selected room given the building identifier, floor identifier, room identifier, booking type, and booking date. This function should only be invoked after collecting all the necessary details from the user. It books the space directly in the system using the Archibus API.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building where the user wishes to book a room. Do not use the street number or address. Example: AB-BAS4."
                },
                "floorId": {
                    "type": "string",
                    "description": "The unique identifier of the floor within the building where the room is to be booked. Example: T404."
                },
                "roomId": {
                    "type": "string",
                    "description": "The identifier of the room to be booked within the specified floor and building. Example: W037."
                },
                "bookingDate": {
                    "type": "string",
                    "description": "The date of the booking, formatted as YYYY-MM-DD. Assume the year to be the current year, 2024, unless specified otherwise."
                },
                "bookingType": {
                    "type": "string",
                    "enum": ["FULLDAY", "AFTERNOON", "MORNING"],
                    "description": "The type of booking the user requires, which determines the duration of the booking. Valid options are 'FULLDAY', 'AFTERNOON', and 'MORNING'."
                }
            },
            "required": ["buildingId", "floorId", "roomId", "bookingDate", "bookingType"]
        }
    }
})
def book_specific_room(buildingId: str, floorId: str, roomId: str, bookingDate: str, bookingType: str):
    #TODO get user login from active directory
    userID = "PAGEERATHAN, JENEERTHAN"

    logging.debug("Book specific room")

    # Make api call to Archibus API to book room
    try:    
        url = "http://localhost:80/api/v1/reservations/"
        
        booking_dto = {
            "buildingId": buildingId,
            "floorId": floorId,
            "roomId": roomId,
            "createdBy": userID,
            "assignedTo": userID,
            "bookingType": bookingType,
            "startDate": bookingDate
        }

        headers = {
            'Content-Type': 'application/json'
        }

        response = requests.post(url=url, json=booking_dto, headers=headers)

        logger.debug(f"Response status code: {response.status_code}")
        logger.debug(f"Response text: {response.text}")

        return f"space {roomId} on floor {floorId} in {buildingId} has been succesfully reserved"

    except requests.HTTPError as e:
        msg = f"Unable to reserve space {roomId} on floor {floorId} in {buildingId}"
        logger.error(msg)
        return msg


@tool_metadata({
    "type": "function",
    "tool_type": "archibus",
    "function": {
        "name": "create_repeat_booking",
        "description": "Creates a new booking for the user based on an existing future-dated booking or the latest booking from the user's history if no reference date is provided. The function replicates the room, building, and booking type found in the referenced booking. The booking is made directly in the system using the Archibus API.",
        "parameters": {
            "type": "object",
            "properties": {
                "bookingDate": {
                    "type": "string",
                    "description": "The preferred date for the new booking, formatted as YYYY-MM-DD. The current date will be used if this parameter is not provided."
                },
                "referenceDate": {
                    "type": "string",
                    "description": "The date of an existing future-dated booking to use as a reference for creating a similar booking, formatted as YYYY-MM-DD. If not provided, the latest booking will be used.",
                    "required": False
                }
            },
            "required": ["bookingDate"]
        }
    }
})
def create_repeat_booking(bookingDate: str, referenceDate: str):
    userId = "PAGEERATHAN, JENEERTHAN"

    logging.debug(f"Creating repeat booking for user {userId}")

    # Make 2 API calls, one to get future booking data, one to create a new booking
    try:
        get_url = f"http://localhost:80/api/v1/reservations/creator/{userId}"
        get_headers = {
            'Accept': 'application/json'
        }
        get_response = requests.get(url=get_url, headers=get_headers)

        logger.debug(f"GET Response status code: {get_response.status_code}")
        logger.debug(f"GET Response text: {get_response.text}")

        # Parse response & make into payload for repeat booking
        booking_history = get_response.json()
        repeat_booking = {
            "id": -1,
            "activityLog": {
                "activityId": -1,
                "requestor": "l, f",
                "activityType": "SERVICE DESK - HOTELING",
                "timeRequested": "1899-12-30T15:29:09",
                "dateRequested": "2024-12-03",
                "dateScheduled": "2024-12-03",
                "assignedTo": "l, f",
                "buildingId": "HQ-BAS4",
                "floorId": "T305",
                "roomId": "W000",
                "createdBy": "l, f",
                "status": "REQUESTED"
            },
            "buildingId": "HQ-BAS4",
            "floorId": "T305",
            "roomId": "W000",
            "dateStart": "2024-12-03",
            "dateEnd": "2024-12-03",
            "emId": "l, f",
            "percentageTime": 50.0,
            "roomCategory": "ABW WK POINT",
            "roomType": "WK TYPE 2",
            "dayPart": 0,
            "department": "08_BUSINESS INFO",
            "parentPercentId": -1,
            "primaryRoom": 0,
            "division": "08_CIO",
            "status": 0
        }

        bookingType = "FULLDAY"

        if repeat_booking['dayPart'] == 1:
            bookingType = "MORNING"
        elif repeat_booking['dayPart'] == 2:
            bookingType = "AFTERNOON"


        if booking_history:
            repeat_booking = booking_history[0]
        else:
            msg = f"No booking history found to create a repeat booking for {bookingDate}"
            logger.error(msg)
            return msg

        # POST request to create the repeat booking based on referenced booking details
        booking_dto = {
            "buildingId": repeat_booking['buildingId'],
            "floorId": repeat_booking['floorId'],
            "roomId": repeat_booking['roomId'],
            "createdBy": userId,
            "assignedTo": userId,
            "bookingType": bookingType,
            "startDate": bookingDate
        }

        logger.debug(f"Booking DTO = {booking_dto}")

        post_url = "http://localhost:80/api/v1/reservations/"
        post_headers = {
            'Content-Type': 'application/json'
        }        
        post_response = requests.post(url=post_url, json=booking_dto, headers=post_headers)

        logger.debug(f"POST Response status code: {post_response.status_code}")
        logger.debug(f"POST Response text: {post_response.text}")

        return f"Repeat booking was successfully created on {bookingDate}"
            
    except requests.HTTPError as e:
        msg = f"Unable to create repeat booking for {bookingDate}"
        logger.error(msg)
        return msg