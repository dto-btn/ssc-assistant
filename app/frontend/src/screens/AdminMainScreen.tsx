import { useEffect, useState } from "react"
import { getMonthlyReport, getWeeklyReport } from "../api/admin.api";
import { Box, CssBaseline } from '@mui/material';
import { MonthlyReport } from "../components/admin/MonthlyReport";
import { MonthlyReportItemModel, WeeklyReportItemModel } from "../api/admin.models";
import { WeeklyReport } from "../components/admin/WeeklyReport";
import { TopMenuAdminPage } from "../components/TopMenu/TopMenuAdminPage";

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
    }, [])

    const dateTodayHumanFormat = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    if (isError) {
        return (
            <h1>There was an error loading the data. Please try again.</h1>
        )
    }

    if (!monthlyReport || !weeklyReport) {
        return (
            <Box>
                <h1>SSC Assistant Reports</h1>
                <h2>Report Date: {dateTodayHumanFormat}</h2>
                <AdminLoadingMessage />
            </Box>
        )
    }

    return (
        <Box>
            <CssBaseline />
            <TopMenuAdminPage />
            <h1>SSC Assistant Reports</h1>
            <h2>Report Date: {dateTodayHumanFormat}</h2>
            <h2>Statistics over time</h2>
            <MonthlyReport data={monthlyReport} />
            <h2>Statistics by day of week</h2>
            <WeeklyReport data={weeklyReport} />
        </Box>
    )
}