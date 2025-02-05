import logging
from .archibus_functions import make_archibus_api_call

logger = logging.getLogger(__name__)


class UserProfile:
    def __init__(self):
        self._profile = None

    def load_profile(self):
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
        return "CODY.ROBILLARD@SSC-SPC.GC.CA"  # Placeholder

    def verify_profile(self):
        self.load_profile()
        return len(self._profile) >= 1

    def get_profile_data(self):
        self.load_profile()
        return self._profile

user_profile = UserProfile()