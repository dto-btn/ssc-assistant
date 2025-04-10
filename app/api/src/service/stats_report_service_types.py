from typing import TypedDict, List, Literal

DistributionOfSessionsPerUser = TypedDict(
    "DistributionOfSessionsPerUser",
    {
        "1": int,
        "2": int,
        "3": int,
        "4": int,
        "5": int,
        "6-10": int,
        "11-20": int,
        "21-50": int,
        "51-100": int,
        "100+": int,
        "label_ordering": Literal[
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
    },
)


class MonthlyUserEngagement(TypedDict):
    month_label: str
    month_start_iso_date: str
    month_end_iso_date: str
    active_users: int
    total_questions_asked: int
    average_questions_per_user: float
    distribution_of_sessions_per_user: DistributionOfSessionsPerUser
