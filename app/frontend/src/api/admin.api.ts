import { MonthlyReportItemModel, MonthlyUserEngagementModel, WeeklyReportItemModel } from "./admin.models";
import { get } from "./api-utils"

type GetMonthlyReportProps = {
    accessToken: string;
}
export const getMonthlyReport = async (props: GetMonthlyReportProps): Promise<MonthlyReportItemModel[]> => {
    const report = await get({
        url: "/api/1.0/stats_report/monthly",
        accessToken: props.accessToken
    });

    return report;
}

export const getWeeklyReport = async (props: GetMonthlyReportProps): Promise<WeeklyReportItemModel[]> => {
    const report = await get({
        url: "/api/1.0/stats_report/weekly",
        accessToken: props.accessToken
    });

    return report;
}

export const getMonthlyUserEngagementReport = async (props: GetMonthlyReportProps): Promise<MonthlyUserEngagementModel[]> => {
    const report = await get({
        url: "/api/1.0/stats_report/monthly_user_engagement",
        accessToken: props.accessToken
    });

    return report;
}