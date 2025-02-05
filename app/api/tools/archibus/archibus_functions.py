import logging
from datetime import datetime

from utils.decorators import tool_metadata

# Basic api helper function
from .api_helper import make_api_call,make_archibus_api_call

# Building information
from .buildingInfo import get_floors, get_floor_plan

# Booking information
from .bookinginfo import get_user_bookings, get_available_rooms

# Employee information
from .employeeinfo import get_employee_record

logger = logging.getLogger(__name__)


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


__all__ = [
    "make_api_call",
    "make_archibus_api_call",
    "get_user_bookings",
    "get_floors",
    "get_available_rooms",
    "get_floor_plan",
    "get_current_date",
    "get_employee_record",
]