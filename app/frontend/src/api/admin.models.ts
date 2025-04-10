export interface MonthlyReportItemModel {
    active_users: number;
    average_questions_asked_per_day: number;
    average_questions_per_user: number;
    month_label: string;
    total_questions_asked: number;
}

export interface WeeklyReportItemModel {
    average_questions_asked_per_day: number;
    average_questions_per_user: number;
    day_of_week: string;
    total_questions_asked: number;
}

export interface MonthlyUserEngagementModel {
    active_users: number;
    average_questions_asked_per_day: number;
    average_questions_per_user: number;
    month_label: string;
    total_questions_asked: number;
}

interface DistributionOfSessionsPerUser {
    "1": number
    "2": number
    "3": number
    "4": number
    "5": number
    "6-10": number
    "11-20": number
    "21-50": number
    "51-100": number
    "100+": number,
    label_ordering: string[]
}

export interface MonthlyUserEngagementModel {
    month_label: string
    month_start_iso_date: string
    month_end_iso_date: string
    active_users: number
    total_questions_asked: number
    average_questions_per_user: number
    distribution_of_sessions_per_user: DistributionOfSessionsPerUser
}