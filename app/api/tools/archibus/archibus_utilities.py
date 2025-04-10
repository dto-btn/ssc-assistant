from pip._internal.utils import datetime
from datetime import datetime, timedelta
from utils.decorators import tool_metadata
from urllib.parse import quote_plus


def get_date_two_months_ago():
    two_months_ago = datetime.now() - timedelta(days=60)
    return two_months_ago.strftime("%Y-%m-%d %H:%M:%S")


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_current_date_and_time",
        "description": "This function is used to know what is the current date and time. It returns the current date and time in text format. Use this if you are unsure of what is the current date, do not make assumptions about the current date and time."
    }
})
def get_current_date_and_time():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_current_date",
        "description": "This function is used to know what is the current date and time. It returns the current date in text format. Use this if you are unsure of what is the current date, do not make assumptions about the current date."
    }
})
def get_current_date():
    return datetime.now().strftime("%Y-%m-%d")


@tool_metadata({
    "type": "function",
    "function": {
        "name": "get_google_maps_link",
        "description": "Generates a clickable Google Maps URL for a given address. Optionally takes latitude and longitude which, if not provided, are obtained from the 'get_building_info' function.",
        "parameters": {
            "type": "object",
            "properties": {
                "address": {
                    "type": "string",
                    "description": "The street address or location name to generate a Google Maps link for."
                },
                "lat": {
                    "type": "number",
                    "format": "float",
                    "description": "The latitude of the location. If missing, it is retrieved from the 'get_building_info' field called bl.lat"
                },
                "long": {
                    "type": "number",
                    "format": "float",
                    "description": "The longitude of the location. If missing, it is retrieved from the 'get_building_info' field called bl.long"
                }
            },
            "required": ["address","lat","long"]
        },
        "returns": {
            "type": "string",
            "description": "A string containing a clickable URL to open the location in Google Maps."
        }
    }
})
def get_google_maps_link (address :str, lat: int, long: int ):

    encoded_address = quote_plus(address)
    url = f"https://www.google.com/maps/search/{encoded_address}"
    if lat and long is not None:
        url = url+f"/@{long}-{lat}"
    return url