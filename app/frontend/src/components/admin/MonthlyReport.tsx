import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MonthlyReportItemModel } from "../../api/admin.models"

type MonthlyReportProps = {
    data: MonthlyReportItemModel[]
}
export const MonthlyReport = ({ data }: MonthlyReportProps) => {
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
                <Bar dataKey="average_questions_asked_per_day" fill="#555555" activeBar={<Rectangle fill="#e6e6e6" stroke="#b3b3b3" />} />

            </BarChart>
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
                <Bar dataKey="total_questions_asked" fill="#ffcc00" activeBar={<Rectangle fill="#fff2cc" stroke="#cc9900" />} />
            </BarChart>
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
                <Bar dataKey="active_users" fill="#ff0000" activeBar={<Rectangle fill="#ffcccc" stroke="#cc0000" />} />
            </BarChart>
            {/* </ResponsiveContainer> */}
        </div>
    );
}