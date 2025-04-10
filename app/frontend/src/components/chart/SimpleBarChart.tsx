import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';

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
            <BarChart
                width={500}
                height={400}
                data={data}
                margin={{
                    top: 5,
                    right: 30,
                    left: 20,
                    bottom: 60,
                }}
                title={title}
            >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey={xKey} angle={-39} textAnchor="end" fontWeight={"bold"} />
                <YAxis fontWeight="bold" />
                <Tooltip />
                <Legend verticalAlign="top" fontWeight={"bold"} />
                <Bar dataKey={yKey} name={title} fill={color} activeBar={<Rectangle fill={color} stroke="#b3b3b3" />} />

            </BarChart>
        </div>
    );
}