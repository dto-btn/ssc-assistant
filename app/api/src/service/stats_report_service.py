from datetime import datetime
from typing import TypedDict
from src.entity.conversation_entity import ConversationEntity
from src.repository.conversation_repository import ConversationRepository

class MonthlyReportRow(TypedDict):
    month_label: str
    month_start_iso_date: str
    month_end_iso_date: str
    active_users: int
    total_questions_asked: int
    average_questions_asked_per_day: float
    average_questions_per_user: float

class StatsReportService:
    def __init__(self, conversation_repository: ConversationRepository):
        self.conversations_cache: list[ConversationEntity] = []
        self.conversation_repository = conversation_repository

    def _get_date_ranges(self):
        return [
            ("Jan 2025", "2025-01-01T00:00:00Z", "2025-01-16T23:59:59Z"),
            ("Dec 2024", "2024-12-01T00:00:00Z", "2024-12-31T23:59:59Z"),
            ("Nov 2024", "2024-11-01T00:00:00Z", "2024-11-30T23:59:59Z"),
            ("Oct 2024", "2024-10-01T00:00:00Z", "2024-10-31T23:59:59Z"),
            ("Sep 2024", "2024-09-01T00:00:00Z", "2024-09-30T23:59:59Z"),
            ("Aug 2024", "2024-08-01T00:00:00Z", "2024-08-31T23:59:59Z"),
            ("Jul 2024", "2024-07-01T00:00:00Z", "2024-07-31T23:59:59Z"),
            ("Jun 2024", "2024-06-01T00:00:00Z", "2024-06-30T23:59:59Z"),
            ("May 2024", "2024-05-01T00:00:00Z", "2024-05-31T23:59:59Z"),
        ]

    def get_statistics_by_month_of_year(self):
        if not self.conversations_cache:
            self.conversations_cache = self.conversation_repository.list_conversations()

        conversations = self.conversations_cache
        date_ranges = self._get_date_ranges()

        rows: list[MonthlyReportRow] = []

        for date_range in date_ranges:
            # Active users
            active_users_set: set[str] = set()
            for conversation in conversations:
                for message in conversation["messages"]:
                    owner_id = message["owner_id"]
                    if owner_id is not None and date_range[1] <= message["created_at"] <= date_range[2]:
                        active_users_set.add(owner_id)

            active_users_count = len(active_users_set)

            # Total questions asked
            total_questions_asked = 0
            for conversation in conversations:
                for message in conversation["messages"]:
                    if date_range[1] <= message["created_at"] <= date_range[2] and message["sender"] == "user":
                        total_questions_asked += 1

            # Average questions asked per day
            start_day = datetime.fromisoformat(date_range[1])
            end_day = datetime.fromisoformat(date_range[2])
            days_in_month = (end_day - start_day).days + 1
            average_questions_per_day = round(total_questions_asked / days_in_month, 2)

            # Average questions per user
            average_questions_per_user = (
                round(total_questions_asked / active_users_count, 2)
                if active_users_count > 0
                else 0
            )

            row = MonthlyReportRow(
                month_label=date_range[0],
                month_start_iso_date=date_range[1],
                month_end_iso_date=date_range[2],
                active_users=active_users_count,
                total_questions_asked=total_questions_asked,
                average_questions_asked_per_day=average_questions_per_day,
                average_questions_per_user=average_questions_per_user
            )

            rows.append(row)

        return rows

    def get_statistics_by_day_of_week(self):
        if not self.conversations_cache:
            self.conversations_cache = self.conversation_repository.list_conversations()

        conversations = self.conversations_cache
        days = [
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
            "Sunday",
        ]
        date_ranges = self._get_date_ranges()

        active_users: set[str] = set()
        for conversation in conversations:
            for message in conversation["messages"]:
                owner_id = message["owner_id"]
                if owner_id is not None:
                    active_users.add(owner_id)

        active_users_count = len(active_users)
        statistics = []

        for day in days:
            total_questions_asked = 0
            for conversation in conversations:
                for message in conversation["messages"]:
                    if (
                        message["sender"] == "user"
                        and datetime.fromisoformat(message["created_at"]).strftime("%A")
                        == day
                    ):
                        total_questions_asked += 1

            average_questions_per_day = total_questions_asked / len(date_ranges)
            average_questions_per_user = (
                total_questions_asked / active_users_count
                if active_users_count > 0
                else 0
            )

            statistics.append(
                {
                    "day_of_week": day,
                    "total_questions_asked": total_questions_asked,
                    "average_questions_asked_per_day": round(
                        average_questions_per_day, 2
                    ),
                    "average_questions_per_user": round(average_questions_per_user, 2),
                }
            )

        return statistics
