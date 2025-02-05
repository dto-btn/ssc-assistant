import React from "react";
import { MonthlyUserEngagementModel } from "../../api/admin.models";
import { SimpleDataTable } from "../chart/SimpleDataTable";
import { Box } from "@mui/material";

type Props = {
    data: MonthlyUserEngagementModel[] | null
}
export const UserEngagementReport: React.FC<Props> = ({ data }) => {
    // [ {"active_users": 2275, "average_questions_per_user": 4.92, "distribution_of_sessions_per_user": {"1": 1530, "2": 353, "3": 179, "4": 76, "5": 38, "100+": 1, "11-20": 26, "21-50": 3, "51-100": 0, "6-10": 69, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-05-31T23:59:59Z", "month_label": "May 2024", "month_start_iso_date": "2024-05-01T00:00:00Z", "total_questions_asked": 11190 }, {"active_users": 962, "average_questions_per_user": 5.91, "distribution_of_sessions_per_user": {"1": 600, "2": 151, "3": 85, "4": 36, "5": 29, "100+": 0, "11-20": 21, "21-50": 4, "51-100": 0, "6-10": 36, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-06-30T23:59:59Z", "month_label": "Jun 2024", "month_start_iso_date": "2024-06-01T00:00:00Z", "total_questions_asked": 5682 }, {"active_users": 655, "average_questions_per_user": 6.41, "distribution_of_sessions_per_user": {"1": 403, "2": 99, "3": 50, "4": 31, "5": 13, "100+": 1, "11-20": 12, "21-50": 6, "51-100": 0, "6-10": 40, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-07-31T23:59:59Z", "month_label": "Jul 2024", "month_start_iso_date": "2024-07-01T00:00:00Z", "total_questions_asked": 4201 }, {"active_users": 601, "average_questions_per_user": 7.95, "distribution_of_sessions_per_user": {"1": 346, "2": 99, "3": 40, "4": 30, "5": 16, "100+": 1, "11-20": 24, "21-50": 7, "51-100": 1, "6-10": 37, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-08-31T23:59:59Z", "month_label": "Aug 2024", "month_start_iso_date": "2024-08-01T00:00:00Z", "total_questions_asked": 4777 }, {"active_users": 665, "average_questions_per_user": 8.98, "distribution_of_sessions_per_user": {"1": 564, "2": 45, "3": 19, "4": 12, "5": 8, "100+": 0, "11-20": 5, "21-50": 1, "51-100": 0, "6-10": 11, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-09-30T23:59:59Z", "month_label": "Sep 2024", "month_start_iso_date": "2024-09-01T00:00:00Z", "total_questions_asked": 5975 }, {"active_users": 856, "average_questions_per_user": 10.79, "distribution_of_sessions_per_user": {"1": 720, "2": 76, "3": 21, "4": 12, "5": 5, "100+": 0, "11-20": 4, "21-50": 2, "51-100": 0, "6-10": 16, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-10-31T23:59:59Z", "month_label": "Oct 2024", "month_start_iso_date": "2024-10-01T00:00:00Z", "total_questions_asked": 9236 }, {"active_users": 1066, "average_questions_per_user": 10.56, "distribution_of_sessions_per_user": {"1": 929, "2": 70, "3": 22, "4": 13, "5": 10, "100+": 0, "11-20": 6, "21-50": 0, "51-100": 0, "6-10": 16, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-11-30T23:59:59Z", "month_label": "Nov 2024", "month_start_iso_date": "2024-11-01T00:00:00Z", "total_questions_asked": 11261 }, {"active_users": 685, "average_questions_per_user": 12.59, "distribution_of_sessions_per_user": {"1": 594, "2": 42, "3": 17, "4": 8, "5": 6, "100+": 0, "11-20": 3, "21-50": 1, "51-100": 0, "6-10": 14, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2024-12-31T23:59:59Z", "month_label": "Dec 2024", "month_start_iso_date": "2024-12-01T00:00:00Z", "total_questions_asked": 8627 }, {"active_users": 1109, "average_questions_per_user": 11.17, "distribution_of_sessions_per_user": {"1": 971, "2": 88, "3": 16, "4": 9, "5": 5, "100+": 0, "11-20": 5, "21-50": 1, "51-100": 0, "6-10": 14, "label_ordering": [ "1", "2", "3", "4", "5", "6-10", "11-20", "21-50", "51-100", "100+" ] }, "month_end_iso_date": "2025-01-31T23:59:59Z", "month_label": "Jan 2025", "month_start_iso_date": "2025-01-01T00:00:00Z", "total_questions_asked": 12383 } ]
    // JSON.stringify(data, null, 2)
    return (
        <Box style={{ display: "flex" }}>
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
                        headerLabel: "Average Questions Per User",
                        key: "average_questions_per_user"
                    },
                    {
                        headerLabel: "Total Questions Asked",
                        key: "total_questions_asked"
                    },
                    {
                        headerLabel: "Distribution of Sessions Per User",
                        key: "distribution_of_sessions_per_user",
                        renderer: (value: any) => {
                            return (
                                <Box sx={{ display: "flex", flexDirection: "row" }}>
                                    <Box sx={{ display: "flex", flexDirection: "column", width: "4rem" }}>
                                        <Box sx={{ border: "1px solid black", padding: "5px" }}>
                                            Count
                                        </Box>
                                        <Box sx={{ padding: "5px", color: "#999999", fontSize: "0.7rem", fontStyle: "italic" }}>
                                            Bucket
                                        </Box>
                                    </Box>
                                    {
                                        value.label_ordering.map((label: string) => (
                                            <Box sx={{ display: "flex", flexDirection: "column", width: "4rem" }} key={label}>
                                                <Box sx={{ border: "1px solid black", padding: "5px" }}>
                                                    {value[label]}
                                                </Box>
                                                <Box sx={{ padding: "5px", color: "#999999", fontSize: "0.7rem", fontStyle: "italic" }}>
                                                    {label}
                                                </Box>
                                            </Box>
                                        ))
                                    }
                                </Box>
                            )
                        }
                    }
                ]}
                data={data}
            />
        </Box>
    )
}