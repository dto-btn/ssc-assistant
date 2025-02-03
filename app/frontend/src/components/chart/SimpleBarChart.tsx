import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { MonthlyReportItemModel } from "../../api/admin.models"

type SimpleBarChartProps = {
    title: string;
    yKey: string;
    xKey: string;
    color: string;
    data: any[];
}


export const SimpleBarChart = ({ title, xKey, yKey, color, data }: SimpleBarChartProps) => {
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
                title={title}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} />
                <YAxis />
                <Tooltip />
                <Legend verticalAlign="top" />
                <Bar dataKey={yKey} name={title} fill={color} activeBar={<Rectangle fill={color} stroke="#b3b3b3" />} />

            </BarChart>
        </div>
    );
}