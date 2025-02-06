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