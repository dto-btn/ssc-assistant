import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { WeeklyReportItemModel } from "../../api/admin.models"

type WeeklyReportProps = {
    data: WeeklyReportItemModel[]
}
export const WeeklyReport = ({ data }: WeeklyReportProps) => {
    return (
        <div>

            {/* <ResponsiveContainer width="100%" height="100%"> */}
            <BarChart
                width={500}
                height={300}
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="average_questions_asked_per_day" fill="#2f4b7c" activeBar={<Rectangle fill="#a05195" stroke="#2f4b7c" />} />
            </BarChart>
            <BarChart
                width={500}
                height={300}
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="average_questions_per_user" fill="#665191" activeBar={<Rectangle fill="#d45087" stroke="#665191" />} />
            </BarChart>
            <BarChart
                width={500}
                height={300}
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 5,
                }}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="month_label" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Bar dataKey="total_questions_asked" fill="#a05195" activeBar={<Rectangle fill="#f95d6a" stroke="#a05195" />} />
            </BarChart>
            {/* </ResponsiveContainer> */}
        </div>
    );
}