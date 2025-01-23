import { MonthlyReportItemModel } from "./admin.models";
import { get } from "./api-utils"

type GetMonthlyReportProps = {
    accessToken: string;
}
export const getMonthlyReport = async (props: GetMonthlyReportProps): Promise<MonthlyReportItemModel[]> => {
    const report = await get({
        url: "/api/1.0/stats_report",
        accessToken: props.accessToken
    });

    return report;
}