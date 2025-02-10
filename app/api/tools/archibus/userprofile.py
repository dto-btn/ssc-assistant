import logging
from .archibus_functions import make_archibus_api_call
from utils.decorators import tool_metadata
from utils.auth import get_or_create_user

logger = logging.getLogger(__name__)


class UserProfile:
    def __init__(self):
        self.user_id = None
        self._profile = None

    def load_profile(self):
        if self.user_id is None:
            self.user_id = get_or_create_user().token["upn"]
        logger.debug("Loading Profile")
        if self._profile is None:
            user_id = self.get_user_id()
            user_url = f"v1/user/{user_id}"
            response = make_archibus_api_call(user_url)
            if response.status_code == 200:
                self._profile = response.json()
            else:
                logger.error(f"Failed to get user with ID {user_id}: {response.text}")
                response.raise_for_status()

    def get_user_id(self):
        return self.user_id

    def verify_profile(self):
        self.load_profile()
        return len(self._profile) >= 1

    def get_profile_data(self):
        self.load_profile()
        return self._profile

    def set_user_id(self, new_user_id=None):
        if new_user_id is None:
            self.user_id = get_or_create_user().token["upn"]
        else:
            self.user_id = new_user_id
        self._profile = None


user_profile = UserProfile()


@tool_metadata({
"type": "function",
"function": {
    "name": "get_archibus_profile",
    "description": "This function returns the ARCHIBUS profile data for an employee.",
    "returns": {
        "type": "object",
        "description": "A JSON object containing ARCHIBUS profile data for the employee.",
        "properties": {
            "role": {"type": "string", "description": "The user's role within the system."},
            "isSecurityGroupAllowed": {"type": "boolean",
                                       "description": "Whether the user has access to secured groups."},
            "name": {"type": "string", "description": "The email identifier of the user."},
            "isMobileEnabled": {"type": "boolean", "description": "Whether mobile access is enabled for the user."},
            "locale": {"type": "string", "description": "The locale preference of the user."},
            "employee": {
                "type": "object",
                "properties": {
                    "sortField": {"type": "string", "description": "The field to sort by for the employee."},
                    "id": {"type": "string", "description": "The unique identifier of the employee."},
                    "emId": {"type": "string", "description": "The email identifier of the employee."},
                    "key": {"type": "string", "description": "A key identifier for the employee."},
                    "email": {"type": "string", "description": "The email address of the employee."}
                }
            },
            "config": {"type": "object", "description": "Additional configuration for the user profile."},
            "email": {"type": "string", "description": "The email address of the user."}
        }
    }
},
"errors": [
    {"code": 400, "message": "Invalid request parameters"},
    {"code": 404, "message": "User profile not found"},
    {"code": 500, "message": "Internal server error"}
]
})
def get_archibus_profile():
    return user_profile.get_profile_data()