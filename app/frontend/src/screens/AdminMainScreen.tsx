import { useEffect, useState } from "react"
import { getMonthlyReport } from "../api/admin.api";
import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Paper, Box } from '@mui/material';
import { MonthlyReport } from "../components/admin/MonthlyReport";
import { MonthlyReportItemModel } from "../api/admin.models";

export const AdminMainScreen = () => {
    const [monthlyReport, setMonthlyReport] = useState<MonthlyReportItemModel[] | null>(null);
    useEffect(() => {
        getMonthlyReport({ accessToken: "not-real" })
            .then(setMonthlyReport)
            .catch(console.error)
    }, [])

    // [
    //     {
    //       "active_users": 5,
    //       "average_questions_asked_per_day": 7.375,
    //       "average_questions_per_user": 23.6,
    //       "month_end_iso_date": "2025-01-16T23:59:59Z",
    //       "month_label": "Jan 2025",
    //       "month_start_iso_date": "2025-01-01T00:00:00Z",
    //       "total_questions_asked": 118
    //     },
    //     {
    //       "active_users": 3,
    //       "average_questions_asked_per_day": 2.161290322580645,
    //       "average_questions_per_user": 22.333333333333332,
    //       "month_end_iso_date": "2024-12-31T23:59:59Z",
    //       "month_label": "Dec 2024",
    //       "month_start_iso_date": "2024-12-01T00:00:00Z",
    //       "total_questions_asked": 67
    //     },
    //     {
    //       "active_users": 3,
    //       "average_questions_asked_per_day": 3.033333333333333,
    //       "average_questions_per_user": 30.333333333333332,
    //       "month_end_iso_date": "2024-11-30T23:59:59Z",
    //       "month_label": "Nov 2024",
    //       "month_start_iso_date": "2024-11-01T00:00:00Z",
    //       "total_questions_asked": 91
    //     },
    //     {
    //       "active_users": 2,
    //       "average_questions_asked_per_day": 6.032258064516129,
    //       "average_questions_per_user": 93.5,
    //       "month_end_iso_date": "2024-10-31T23:59:59Z",
    //       "month_label": "Oct 2024",
    //       "month_start_iso_date": "2024-10-01T00:00:00Z",
    //       "total_questions_asked": 187
    //     },
    //     {
    //       "active_users": 2,
    //       "average_questions_asked_per_day": 7.533333333333333,
    //       "average_questions_per_user": 113,
    //       "month_end_iso_date": "2024-09-30T23:59:59Z",
    //       "month_label": "Sep 2024",
    //       "month_start_iso_date": "2024-09-01T00:00:00Z",
    //       "total_questions_asked": 226
    //     },
    //     {
    //       "active_users": 2,
    //       "average_questions_asked_per_day": 27.967741935483872,
    //       "average_questions_per_user": 433.5,
    //       "month_end_iso_date": "2024-08-31T23:59:59Z",
    //       "month_label": "Aug 2024",
    //       "month_start_iso_date": "2024-08-01T00:00:00Z",
    //       "total_questions_asked": 867
    //     },
    //     {
    //       "active_users": 2,
    //       "average_questions_asked_per_day": 8.451612903225806,
    //       "average_questions_per_user": 131,
    //       "month_end_iso_date": "2024-07-31T23:59:59Z",
    //       "month_label": "Jul 2024",
    //       "month_start_iso_date": "2024-07-01T00:00:00Z",
    //       "total_questions_asked": 262
    //     },
    //     {
    //       "active_users": 1,
    //       "average_questions_asked_per_day": 1.1666666666666667,
    //       "average_questions_per_user": 35,
    //       "month_end_iso_date": "2024-06-30T23:59:59Z",
    //       "month_label": "Jun 2024",
    //       "month_start_iso_date": "2024-06-01T00:00:00Z",
    //       "total_questions_asked": 35
    //     },
    //     {
    //       "active_users": 1,
    //       "average_questions_asked_per_day": 3.967741935483871,
    //       "average_questions_per_user": 123,
    //       "month_end_iso_date": "2024-05-31T23:59:59Z",
    //       "month_label": "May 2024",
    //       "month_start_iso_date": "2024-05-01T00:00:00Z",
    //       "total_questions_asked": 123
    //     },
    //     {
    //       "active_users": 13,
    //       "average_questions_asked_per_day": 7.3731884057971016,
    //       "average_questions_per_user": 156.53846153846155,
    //       "month_end_iso_date": "2025-01-31T23:59:59Z",
    //       "month_label": "Lifetime",
    //       "month_start_iso_date": "2024-05-01T00:00:00Z",
    //       "total_questions_asked": 2035
    //     }
    //   ]

    return (
        <Box>
            <h1>Admin Main Screen</h1>
            <h2>Monthly Report</h2>
            {monthlyReport && (
                <MonthlyReport data={monthlyReport} />
            )}
            {monthlyReport && (
                <Box maxWidth={800}>
                    <TableContainer component={Paper} variant="outlined">
                        <Table>
                            <TableHead>
                                <TableRow>
                                    <TableCell>Month</TableCell>
                                    <TableCell>Active Users</TableCell>
                                    <TableCell>Average Questions Asked Per Day</TableCell>
                                    <TableCell>Average Questions Per User</TableCell>
                                    <TableCell>Total Questions Asked</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {monthlyReport.map((report: any, index: number) => (
                                    <TableRow key={index}>
                                        <TableCell>{report.month_label}</TableCell>
                                        <TableCell>{report.active_users}</TableCell>
                                        <TableCell>{report.average_questions_asked_per_day}</TableCell>
                                        <TableCell>{report.average_questions_per_user}</TableCell>
                                        <TableCell>{report.total_questions_asked}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Box >
            )}
        </Box>
    )
}