import logging
from datetime import datetime

import requests
from utils.decorators import tool_metadata

# Basic api helper function
from .api_helper import make_api_call,make_archibus_api_call

# Building information
from .buildingInfo import get_floors, get_floor_plan

# Booking information
from .bookinginfo import get_user_bookings, get_available_rooms

# Employee information
from .employeeinfo import get_employee_record

# User profile information
from .userprofile import get_user_profile_by_id

logger = logging.getLogger(__name__)

profile = get_user_profile_by_id()


@tool_metadata({
    "type": "function",
    "function": {
        "name":"get_profile_data",
        "description":"This function returns a profile objected need for other functionality this is not same as employee information"
    }
})
def get_profile_data():
    return profile

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
    return "Formatted date and time: " + current_date_time.strftime("%Y-%m-%d %H:%M:%S")


def verify_user_profile():
    return len(profile) >= 1


valid_profile = verify_user_profile()
print(valid_profile)

__all__ = [
    "make_api_call",
    "make_archibus_api_call",
    "get_user_bookings",
    "get_floors",
    "get_available_rooms",
    "get_floor_plan",
    "get_current_date",
    "get_employee_record",
    "get_profile_data",
    valid_profile,
    profile,
]