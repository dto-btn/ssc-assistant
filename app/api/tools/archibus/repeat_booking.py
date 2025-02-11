import datetime
import json
import requests
import logging

from app.api.tools.archibus.api_helper import make_archibus_api_call
from .userprofile import user_profile
from app.api.utils.auth import get_or_create_user
from app.api.utils.decorators import tool_metadata

logger = logging.getLogger(__name__)
logger.setLevel(logging.DEBUG)


@tool_metadata({
    "type": "function",
    "tool_type": "archibus",
    "function": {
        "name": "create_repeat_booking",
        "description": "Creates a new booking for the user based on an existing future-dated booking or the latest booking from the user's history if no reference date is provided. The function replicates the room, building, and booking type found in the referenced booking. The booking is made directly in the system using the Archibus API. USE THE GET_FUTURE_BOOKINGS TOOL FUNCTION TO RETRIEVE THE USER'S FUTURE BOOKINGS, AND USE THE LATEST BOOKING IF NOT SPECIFIED",
        "parameters": {
            "type": "object",
            "properties": {
                "buildingId": {
                    "type": "string",
                    "description": "The unique identifier of the building where the user wishes to book a room. Do not use the street number or address. Example: AB-BAS4. IF YOU DONT HAVE A BUILDINGID, USE GET_FUTURE_BUILDINGS TOOL FUNCTION FIRST. DO NOT USE THE BUILDING ADDRESS OR NAME AS THE BUILDINGID."
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
                },
                "referenceDate": {
                    "type": "string",
                    "description": "The date of an existing future-dated booking to use as a reference for creating a similar booking, formatted as YYYY-MM-DD. If not provided, the latest booking will be used which can be found using the get_bookings tool function.",
                }
            },
            "required": ["buildingId", "floorId", "roomId", "bookingDate", "bookingType", "referenceDate"],
        }
    }
})
def create_repeat_booking(bookingDate: str, buildingId: str, floorId: str, roomId: str, bookingType: str,  referenceDate: str = "",):
    # userID = "PAGEERATHAN, JENEERTHAN"
    first_name = get_or_create_user().token['given_name']
    last_name = get_or_create_user().token['family_name']
    userId = last_name + ', ' + first_name

    logging.debug(f"Creating repeat booking for user {userId}")

    # Make 2 API calls, one to get future booking data, one to create a new booking
    # TODO Use General book to create new booking
    # TODO Use Verify Booking
    # TODO Show Floor Plan
    try:

        booking_dto = {
            "buildingId": buildingId,
            "floorId": floorId,
            "roomId": roomId,
            "createdBy": userId,
            "assignedTo": userId,
            "bookingType": bookingType,
            "startDate": bookingDate
        }

        post_url = "http://localhost:80/api/v1/reservations/"
        post_headers = {
            'Content-Type': 'application/json'
        }
        post_response = requests.post(url=post_url, json=booking_dto, headers=post_headers)

        logger.debug(f"POST Response status code: {post_response.status_code}")
        logger.debug(f"POST Response text: {post_response.text}")

        return f"Repeat booking was successfully created for {bookingDate} at {booking_dto['buildingId']} on floor {booking_dto['floorId']} for room {booking_dto['roomId']}"

    except requests.HTTPError as e:
        msg = f"Unable to create repeat booking for {bookingDate}"
        logger.error(msg)
        return msg


@tool_metadata({
    "type": "function",
    "tool_type": "archibus",
    "function": {
        "name": "get_future_bookings",
        "description": "Fetches a list of all upcoming room bookings from the Archibus system. This function provides comprehensive details about each booking, including room status, category, type, booking start and end dates, and associated department and employee identifiers.",
        "returns": {
            "description": "An array of objects representing booking records. Each object contains detailed information about the room and the booking, such as room status, building, room category, room identifier, division and department identifiers, site identifier, booking start and end dates, floor identifier, room standard, and the employee identifier for the person who made the booking.",
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "rm.status": {
                        "type": "string",
                        "description": "The current status of the room, such as 'Available', 'Booked', etc."
                    },
                    "rmpct.pct_id": {
                        "type": "integer",
                        "description": "The percentage ID of the booking, serving as a unique booking reference."
                    },
                    "bl.bl_id": {
                        "type": "string",
                        "description": "The unique identifier for the building where the room is located."
                    },
                    "rm.rm_cat": {
                        "type": "string",
                        "description": "The category of the room, for example 'ABW WK POINT' indicating a type of working point."
                    },
                    "rm.rm_id": {
                        "type": "string",
                        "description": "The unique identifier for the specific room that is booked."
                    },
                    "rmpct.dv_id": {
                        "type": "string",
                        "description": "The division identifier within the company that the booking is associated with."
                    },
                    "rm.rm_type": {
                        "type": "string",
                        "description": "The type of the room, describing its features or intended use."
                    },
                    "rmpct.dp_id": {
                        "type": "string",
                        "description": "The department identifier within the division that the booking is associated with."
                    },
                    "bl.site_id": {
                        "type": "string",
                        "description": "The site identifier of the building, which could be linked to a campus or a larger area that the building is part of."
                    },
                    "rmpct.date_start": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The start date and time of the booking in ISO 8601 format."
                    },
                    "rmpct.date_end": {
                        "type": "string",
                        "format": "date-time",
                        "description": "The end date and time of the booking in ISO 8601 format."
                    },
                    "rm.fl_id": {
                        "type": "string",
                        "description": "The floor identifier where the room is situated within the building."
                    },
                    "rm.rm_std": {
                        "type": "string",
                        "description": "The room standard which describes the furnishings or layout of the room."
                    },
                    "rmpct.em_id": {
                        "type": "string",
                        "description": "The employee identifier of the individual who made the booking."
                    }
                }
            }
        },
        "errors": {
            "description": "A list of potential errors that could occur during the function execution, indicating issues that need to be handled, such as when no bookings are found or when there is a system-related error.",
            "type": "array",
            "items": {
                "type": "string",
                "enum": [
                    "NoBookingsFound",
                    "DatabaseConnectionError",
                    "DataRetrievalError"
                ]
            }
        }
    }
})
def get_future_bookings():
    if user_profile.verify_profile():
        emId = user_profile.get_profile_data()['employee']['emId']
        if emId:
            current_date = datetime.date.today().isoformat()

            payload = [
                {
                    "fieldName": "em_id",
                    "filterValue": emId,
                    "filterOperation": "="
                },
                {
                    "fieldName": "date_start",
                    "filterValue": current_date,
                    "filterOperation": ">"
                }
            ]
            response = make_archibus_api_call(
                uri=f"v1/data?viewName=ssc-ht-rr-rpt-booking.axvw&dataSource=searchBookingConsole_formDS", payload=payload, httptype='GET')
            return json.loads(response.text)
        else:
            return False
    else:
        return False
