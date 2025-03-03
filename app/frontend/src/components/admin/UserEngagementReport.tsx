import React from "react";
import { MonthlyUserEngagementModel } from "../../api/admin.models";
import { SimpleDataTable } from "../chart/SimpleDataTable";
import { Box } from "@mui/material";

type Props = {
    data: MonthlyUserEngagementModel[]
}
export const UserEngagementReport: React.FC<Props> = ({ data }) => {
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
                        headerLabel: "Distribution of Conversation Lengths",
                        key: "distribution_of_sessions_per_user",
                        renderer: (value: any) => {
                            return (
                                <Box sx={{ display: "flex", flexDirection: "row" }}>
                                    <Box sx={{ display: "flex", flexDirection: "column", width: "6rem" }}>
                                        <Box sx={{ border: "1px solid black", padding: "5px" }}>
                                            # Convo's
                                        </Box>
                                        <Box sx={{ padding: "5px", color: "#999999", fontSize: "0.7rem", fontStyle: "italic" }}>
                                            Convo Length
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