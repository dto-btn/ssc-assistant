from datetime import datetime, timedelta
from typing import TypedDict
from src.entity.conversation_entity import ConversationEntity
from src.repository.conversation_repository import ConversationRepository
from src.service.stats_report_service_types import (
    MonthlyUserEngagement,
    DistributionOfSessionsPerUser,
)


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
            ("May 2024", "2024-05-01T00:00:00Z", "2024-05-31T23:59:59Z"),
            ("Jun 2024", "2024-06-01T00:00:00Z", "2024-06-30T23:59:59Z"),
            ("Jul 2024", "2024-07-01T00:00:00Z", "2024-07-31T23:59:59Z"),
            ("Aug 2024", "2024-08-01T00:00:00Z", "2024-08-31T23:59:59Z"),
            ("Sep 2024", "2024-09-01T00:00:00Z", "2024-09-30T23:59:59Z"),
            ("Oct 2024", "2024-10-01T00:00:00Z", "2024-10-31T23:59:59Z"),
            ("Nov 2024", "2024-11-01T00:00:00Z", "2024-11-30T23:59:59Z"),
            ("Dec 2024", "2024-12-01T00:00:00Z", "2024-12-31T23:59:59Z"),
            ("Jan 2025", "2025-01-01T00:00:00Z", "2025-01-31T23:59:59Z"),
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
                    if (
                        owner_id is not None
                        and date_range[1] <= message["created_at"] <= date_range[2]
                        and message["sender"] == "user"
                    ):
                        active_users_set.add(owner_id)

            active_users_count = len(active_users_set)

            # Total questions asked
            total_questions_asked = 0
            for conversation in conversations:
                for message in conversation["messages"]:
                    if (
                        date_range[1] <= message["created_at"] <= date_range[2]
                        and message["sender"] == "user"
                    ):
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
                average_questions_per_user=average_questions_per_user,
            )

            rows.append(row)

        return rows

    def get_statistics_by_day_of_week(self):
        if not self.conversations_cache:
            self.conversations_cache = self.conversation_repository.list_conversations()

        conversations = self.conversations_cache
        days = [
            "Sunday",
            "Monday",
            "Tuesday",
            "Wednesday",
            "Thursday",
            "Friday",
            "Saturday",
        ]
        date_ranges = self._get_date_ranges()

        active_users: set[str] = set()
        for conversation in conversations:
            for message in conversation["messages"]:
                owner_id = message["owner_id"]
                if owner_id is not None and message["sender"] == "user":
                    active_users.add(owner_id)

        active_users_count = len(active_users)
        statistics = []

        for day_name in days:
            total_questions_asked = 0
            for conversation in conversations:
                for message in conversation["messages"]:
                    if (
                        message["sender"] == "user"
                        and datetime.fromisoformat(message["created_at"]).strftime("%A")
                        == day_name
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
                    "day_of_week": day_name,
                    "total_questions_asked": total_questions_asked,
                    "average_questions_asked_per_day": round(
                        average_questions_per_day, 2
                    ),
                    "average_questions_per_user": round(average_questions_per_user, 2),
                }
            )

        return statistics

    def get_top_users_past_90_days(self):
        if not self.conversations_cache:
            self.conversations_cache = self.conversation_repository.list_conversations()

        conversations = self.conversations_cache

        date_range = (
            datetime.now().isoformat(),
            (datetime.now() - timedelta(days=90)).isoformat(),
        )

        active_users: dict[str, int] = {}

        for conversation in conversations:
            for message in conversation["messages"]:
                owner_id = message["owner_id"]
                if (
                    owner_id is not None
                    and date_range[1] <= message["created_at"] <= date_range[0]
                    and message["sender"] == "user"
                ):
                    if owner_id in active_users:
                        active_users[owner_id] += 1
                    else:
                        active_users[owner_id] = 1

        sorted_users = sorted(active_users.items(), key=lambda x: x[1], reverse=True)

        return sorted_users

    def get_monthly_user_engagement_report(self) -> list[MonthlyUserEngagement]:
        # On a monthly basis, report on active users; total questions asked; average questions per user; and distribution of number of sessions per user
        # Here are the definitions of the fields:
        # - Active users: the number of unique users who asked at least one question in the month.
        # - Total questions asked: the total number of questions asked by all users in the month.
        # - Average questions per user: the total questions asked divided by the number of active users.
        # - Distribution of number of sessions per user: the number of users who asked 1 question, 2 questions, 3 questions, etc. in the month.
        #     - The buckets should be 1, 2, 3, 4, 5, 6-10, 11-20, 21-50, 51-100, 100+.
        if not self.conversations_cache:
            self.conversations_cache = self.conversation_repository.list_conversations()

        date_ranges = self._get_date_ranges()
        monthly_engagement: list[MonthlyUserEngagement] = []

        for month_label, month_start_iso_date, month_end_iso_date in date_ranges:
            user_questions = {}
            user_sessions = {}

            for conversation in self.conversations_cache:
                users_in_convo = set()
                for message in conversation["messages"]:
                    if (
                        month_start_iso_date
                        <= message["created_at"]
                        <= month_end_iso_date
                        and message["sender"] == "user"
                    ):
                        owner_id = message["owner_id"]
                        if owner_id:
                            user_questions[owner_id] = (
                                user_questions.get(owner_id, 0) + 1
                            )
                            users_in_convo.add(owner_id)

                for user_id in users_in_convo:
                    user_sessions[user_id] = user_sessions.get(user_id, 0) + 1

            active_users_count = len(user_questions)
            total_questions_asked = sum(user_questions.values())
            average_questions_per_user = (
                round(total_questions_asked / active_users_count, 2)
                if active_users_count
                else 0
            )

            distribution: DistributionOfSessionsPerUser = {
                "1": 0,
                "2": 0,
                "3": 0,
                "4": 0,
                "5": 0,
                "6-10": 0,
                "11-20": 0,
                "21-50": 0,
                "51-100": 0,
                "100+": 0,
                "label_ordering": [
                    "1",
                    "2",
                    "3",
                    "4",
                    "5",
                    "6-10",
                    "11-20",
                    "21-50",
                    "51-100",
                    "100+",
                ],
            }
            for _, session_count in user_sessions.items():
                if session_count <= 5:
                    distribution[str(session_count)] += 1
                elif session_count <= 10:
                    distribution["6-10"] += 1
                elif session_count <= 20:
                    distribution["11-20"] += 1
                elif session_count <= 50:
                    distribution["21-50"] += 1
                elif session_count <= 100:
                    distribution["51-100"] += 1
                else:
                    distribution["100+"] += 1

            monthly_engagement.append(
                {
                    "month_label": month_label,
                    "month_start_iso_date": month_start_iso_date,
                    "month_end_iso_date": month_end_iso_date,
                    "active_users": active_users_count,
                    "total_questions_asked": total_questions_asked,
                    "average_questions_per_user": average_questions_per_user,
                    "distribution_of_sessions_per_user": distribution,
                }
            )

        return monthly_engagement