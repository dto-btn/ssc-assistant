import React from "react";
import { MonthlyUserEngagementModel } from "../../api/admin.models";

type Props = {
    data: MonthlyUserEngagementModel[] | null
}
export const UserEngagementReport: React.FC<Props> = ({ data }) => {
    return (
        JSON.stringify(data), null, 2
    )
}