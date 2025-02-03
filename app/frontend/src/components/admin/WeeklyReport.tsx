import { BarChart, Bar, Rectangle, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { WeeklyReportItemModel } from "../../api/admin.models"
import { Box } from '@mui/material';
import { SimpleDataTable } from '../chart/SimpleDataTable';
import { SimpleBarChart } from '../chart/SimpleBarChart';

type WeeklyReportProps = {
    data: WeeklyReportItemModel[]
}
export const WeeklyReport = ({ data }: WeeklyReportProps) => {
    return (
        <Box>
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center' }}>
                {/* <SimpleBarChart
                                title='Active Users'
                                xKey='month_label'
                                yKey='active_users'
                                color='#ff0000'
                                data={data}
                            /> */}

                <SimpleBarChart
                    title='Average Questions Asked Per Day'
                    xKey='day_of_week'
                    yKey='average_questions_asked_per_day'
                    color='#555555'
                data={data}
                />
                <SimpleBarChart
                    title='Average Questions Per User'
                    xKey='day_of_week'
                    yKey='average_questions_per_user'
                    color='#665191'
                    data={data}
                />
                <SimpleBarChart
                    title='Total Questions Asked'
                    xKey='day_of_week'
                    yKey='total_questions_asked'
                    color='#a05195'
                    data={data}
                />
            </Box>
            <SimpleDataTable
                columnMappings={[
                    {
                        headerLabel: "Day of Week",
                        key: "day_of_week"
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
        </Box>
    );
}