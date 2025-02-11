import json
import requests
import logging

from app.api.tools.archibus.api_helper import make_archibus_api_call
from app.api.utils.auth import get_or_create_user
from app.api.utils.decorators import tool_metadata

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


@tool_metadata({
    "type": "function",
    "tool_type": "archibus",
    "function": {
        "name": "book_specific_room",
        "description": "Books a selected room given the building identifier, floor identifier, room identifier, booking type, and booking date. This function should only be invoked after collecting all the necessary details from the user. It books the space directly in the system using the Archibus API. IF YOU DONT HAVE A BUILDINGID, USE GET_BUILDINGS TOOL FUNCTION FIRST. DO NOT USE THE BUILDING ADDRESS OR NAME AS THE BUILDINGID.",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building where the user wishes to book a room. Do not use the street number or address. Example: AB-BAS4. IF YOU DONT HAVE A BUILDINGID, USE GET_BUILDINGS TOOL FUNCTION FIRST. DO NOT USE THE BUILDING ADDRESS OR NAME AS THE BUILDINGID."
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
    # userID = "PAGEERATHAN, JENEERTHAN"
    first_name = get_or_create_user().token['given_name']
    last_name = get_or_create_user().token['family_name']
    userID = last_name + ', '  + first_name

    logging.debug("Book specific room")

    # Make api call to Archibus API to book room
    try:
        # TODO Use general book method to reserve booking
        # TODO Use verify booking for booking_dto
        # TODO Make 2 calls if needed to fetch bl id
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

        logging.debug('Booking specific room dto: %s', booking_dto)

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
        "name": "get_buildings",
        "description": "Retrieves a list of all buildings and their details from the Archibus database. This function returns information such as the building identifier, name, address, and zip code, enabling comprehensive building management and easier room booking.",
        "returns": {
            "description": "A list of building information objects. Each object contains a building identifier, name, address, and zip code.",
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "bl.bl_id": {
                        "type": "string",
                        "description": "The unique identifier for the building."
                    },
                    "bl.name": {
                        "type": "string",
                        "description": "The official name of the building, which may include the street name and number."
                    },
                    "bl.bl_id.key": {
                        "type": "string",
                        "description": "A duplicate of the building identifier, provided for consistency across different Archibus modules and functions."
                    },
                    "bl.address1": {
                        "type": "string",
                        "description": "The primary address line for the building, typically containing the street name and number."
                    },
                    "bl.zip": {
                        "type": "string",
                        "description": "The postal zip code for the building's location."
                    }
                }
            }
        },
        "errors": {
            "description": "A list of potential errors that could be encountered during the execution of the function.",
            "type": "array",
            "items": {
                "type": "string",
                "enum": [
                    "DatabaseConnectionError",
                    "DataRetrievalError"
                ]
            }
        }
    }
})
def get_buildings():
    try:
        response = make_archibus_api_call(uri=f"v1/data?viewName=ab-sp-vw-bl.axvw&dataSource=abSpVwBl_ds_0", httptype='GET')
        return json.loads(response.text)
    except requests.HTTPError as e:
        msg = "Unable to get building info"
        logger.error(msg)
        return msg