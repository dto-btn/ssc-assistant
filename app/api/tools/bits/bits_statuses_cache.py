import os
import json

class StatusesCache:
    """Cache for BR statuses loaded from a JSON file."""
    _statuses = []

    @classmethod
    def load_statuses(cls):
        """Load statuses from the JSON file if not already loaded."""
        if cls._statuses is None:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            file_path = os.path.join(script_dir, "bits_statuses.json")
            with open(file_path, 'r', encoding='utf-8') as statuses:
                cls._statuses = json.load(statuses) # list of dicts
        return cls._statuses

    @classmethod
    def get_statuses(cls):
        """Return all the  statuses and their matching phases."""
        return cls.load_statuses()

    @classmethod
    def get_status_ids(cls):
      """Get all status IDs from the loaded statuses."""
      statuses = cls.load_statuses()
      if not isinstance(statuses, list):
          raise TypeError("Loaded statuses are not a list")
      return {status["STATUS_ID"] for status in statuses}
