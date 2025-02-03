import { MonthlyReportItemModel } from "../../api/admin.models"
import { SimpleBarChart } from '../chart/SimpleBarChart';
import { SimpleDataTable } from "../chart/SimpleDataTable";

type MonthlyReportProps = {
    data: MonthlyReportItemModel[]
}
export const MonthlyReport = ({ data }: MonthlyReportProps) => {
    return (
        <div>
            <SimpleBarChart
                title='Average Questions Asked Per Day'
                xKey='month_label'
                yKey='average_questions_asked_per_day'
                color='#555555'
                data={data}
            />
            <SimpleBarChart
                title='Total Questions Asked'
                xKey='month_label'
                yKey='total_questions_asked'
                color='#ffcc00'
                data={data}
            />
            <SimpleBarChart
                title='Active Users'
                xKey='month_label'
                yKey='active_users'
                color='#ff0000'
                data={data}
            />
            <SimpleDataTable
                columnMappings={[
                    {
                        headerLabel: "Month",
                        key: "month_label"
                    },
                    {
                        headerLabel: "Active Users",
                        key: "active_users"
                    },
                    {
                        headerLabel: "Average Questions Asked Per Day",
                        key: "average_questions_asked_per_day"
                    },
                    {
                        headerLabel: "Average Questions Per User",
                        key: "average_questions_per_user"
                    },
                    {
                        headerLabel: "Total Questions Asked",
                        key: "total_questions_asked"
                    }
                ]}
                data={data}
            />
        </div>
    );
}