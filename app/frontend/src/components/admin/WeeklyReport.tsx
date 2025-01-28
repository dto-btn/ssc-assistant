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
                <Bar dataKey="active_users" fill="#8884d8" activeBar={<Rectangle fill="pink" stroke="blue" />} />
                <Bar dataKey="average_questions_asked_per_day" fill="#82ca9d" activeBar={<Rectangle fill="gold" stroke="purple" />} />
                <Bar dataKey="average_questions_per_user" fill="#ff0000" activeBar={<Rectangle fill="green" stroke="black" />} />
                <Bar dataKey="total_questions_asked" fill="#00ff00" activeBar={<Rectangle fill="black" stroke="red" />} />
            </BarChart>
            {/* </ResponsiveContainer> */}
        </div>
    );
}