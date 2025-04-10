import json
import logging
from utils.decorators import tool_metadata

# from .api_helper import make_archibus_api_call
# from .archibus_utilities import get_current_date, get_date_two_months_ago
# from .userprofile import user_profile

logger = logging.getLogger(__name__)

@tool_metadata({
    "type": "function",
    "function": {
        "name": "generate_analytical_report_on_locations",
        "description": "Generates a report containing data and booking information based on the given building, floor, room and employee parameters. fl_id is missing use fetch_room_availability",
        "parameters": {
            "type": "object",
            "properties": {
                "bl_id": {
                    "type": "string",
                    "description": "The ID of the building for which the report is to be generated."
                },
                "fl_id": {
                    "type": "string",
                    "description": "The ID of the floor within the specified building for the report. This field is optional. if this is missing get a list of floors from fetch_room_availability"
                },
                "start_date": {
                    "type": "string",
                    "description": "The start date for the report period in YYYY-MM-DD format. If not provided, defaults to the beginning of the current fiscal or calendar year."
                },
                "end_date": {
                    "type": "string",
                    "description": "The end date for the report period in YYYY-MM-DD format. If not provided, defaults to the end of the current fiscal or calendar year."
                },
                "rm_id": {
                    "type": "string",
                    "description": "The ID of the room within the specified floor and building for the report. This field is optional."
                },
                "em_id": {
                    "type": "string",
                    "description": "The ID of the employee associated with the bookings. This field is optional."
                }
            },
            "required": ["bl_id", "fl_id"]
        }
    }
})
def generate_analytical_report_on_locations(bl_id: str ,  fl_id: str, start_date: str = None, end_date: str = None, rm_id: str = None, em_id: str = None ):
    from .api_helper import make_archibus_api_call
    from .archibus_utilities import get_current_date, get_date_two_months_ago
    from .userprofile import user_profile

    if user_profile.verify_profile():
        if start_date is None:
            start_date = get_date_two_months_ago()
        if end_date is None:
            end_date = get_current_date()

        payload = [
            {
                "fieldName": "bl_id",
                "filterValue": bl_id,
                "filterOperation": "="
            },
            {
                "fieldName": "fl_id",
                "filterValue": fl_id,
                "filterOperation": "="
            },
            {
                "fieldName": "date_start",
                "filterValue": start_date,
                "filterOperation": ">="
            },
            {
                "fieldName": "end_date",
                "filterValue": end_date,
                "filterOperation": "<="
            },

        ]

        if rm_id is not None:
            payload.append({
                "fieldName": "rm_id",
                "filterValue": rm_id,
                "filterOperation": "="
            })
        if em_id is not None:
            payload.append({
                "fieldName": "em_id",
                "filterValue": em_id,
                "filterOperation": "="
            })

        response = make_archibus_api_call(f"v1/data?viewName=ssc-system-util.axvw&dataSource=historical_booking_ds", payload, 'GET')
        return json.loads(response.text)
    else:
        return False


