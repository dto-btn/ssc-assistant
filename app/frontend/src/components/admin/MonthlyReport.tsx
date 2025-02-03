import { MonthlyReportItemModel } from "../../api/admin.models"
import { SimpleBarChart } from '../chart/SimpleBarChart';

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
        </div>
    );
}