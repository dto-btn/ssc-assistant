import { useEffect, useState } from "react"
import { getMonthlyReport, getMonthlyUserEngagementReport, getWeeklyReport } from "../api/admin.api";
import { Box, CssBaseline, Typography } from '@mui/material';
import { MonthlyReport } from "../components/admin/MonthlyReport";
import { MonthlyReportItemModel, MonthlyUserEngagementModel, WeeklyReportItemModel } from "../api/admin.models";
import { WeeklyReport } from "../components/admin/WeeklyReport";
import { TopMenuAdminPage } from "../components/TopMenu/TopMenuAdminPage";
import { UserEngagementReport } from "../components/admin/UserEngagementReport";

const AdminLoadingMessage = () => {
    const [showIsCachingMessage, setShowIsCachingMessage] = useState(false);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setShowIsCachingMessage(true);
        }, 7000);

        return () => {
            clearTimeout(timeout);
        }
    }, [])

    if (showIsCachingMessage) {
        return (
            <h1>SSC Assistant is caching the data. Please wait... DO NOT REFRESH THE PAGE as it will slow down the process.</h1>
        )
    }

    return (
        <h1>Loading...</h1>
    )
}

export const AdminMainScreen = () => {
    const [monthlyUserEngagementReport, setMonthlyUserEngagementReport] = useState<MonthlyUserEngagementModel[] | null>(null);
    const [monthlyReport, setMonthlyReport] = useState<MonthlyReportItemModel[] | null>(null);
    const [weeklyReport, setWeeklyReport] = useState<WeeklyReportItemModel[] | null>(null);
    const [isError, setIsError] = useState(false);

    const setError = (e: any) => {
        console.error(e);
        setIsError(true);
    }

    useEffect(() => {
        getMonthlyReport({ accessToken: "not-real" })
            .then(setMonthlyReport)
            .catch(setError);

        getWeeklyReport({ accessToken: "not-real" })
            .then(setWeeklyReport)
            .catch(setError);

        getMonthlyUserEngagementReport({ accessToken: "not-real" })
            .then(setMonthlyUserEngagementReport)
            .catch(setError);
    }, [])

    const dateTodayHumanFormat = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return (
        <Box>
            <CssBaseline />
            <TopMenuAdminPage />
            <Box display={"flex"} flexDirection={"column"} gap={2} p={2}>
                {(() => {

                    if (isError) {
                        return (
                            <h1>There was an error loading the data. Please try again.</h1>
                        )
                    }

                    if (!monthlyReport || !weeklyReport || !monthlyUserEngagementReport) {
                        return (
                            <Box>
                                <h1>SSC Assistant Reports</h1>
                                <h2>Report Date: {dateTodayHumanFormat}</h2>
                                <AdminLoadingMessage />
                            </Box>
                        )
                    }

                    return (
                        <>
                            <Typography variant="h1">SSC Assistant Reports</Typography>
                            <Typography variant="body1" fontWeight={"bold"}>Report Date: {dateTodayHumanFormat}</Typography>
                            <Typography variant="h2">Monthly User Engagement</Typography>
                            <Typography variant="body1">This report shows the SSC Assistant's user engagement statistics month-over-month.</Typography>
                            <UserEngagementReport data={monthlyUserEngagementReport} />
                            <Typography variant="h2">Statistics over time</Typography>
                            <Typography variant="body1">This report shows the SSC Assistant's usage statistics month-over-month.</Typography>
                            <MonthlyReport data={monthlyReport} />
                            <Typography variant="h2" fontWeight={"bold"}>Statistics by day of week</Typography>
                            <Typography variant="body1">
                                This report compares the SSC Assistant's statistics by day of the week.
                            </Typography>
                            <WeeklyReport data={weeklyReport} />
                        </>
                    )
                })()}
            </Box>
        </Box>
    )

}