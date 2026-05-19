import { FC } from "react";
import { createBrowserRouter, Outlet, RouterProvider } from "react-router";
import { RootRoute } from ".";
import { SuggestCallbackRoute } from "./SuggestCallbackRoute";
import PlaygroundRoute from "./PlaygroundRoute";
import { GoogleAnalyticsTracker } from "../components/GoogleAnalytics";

const AnalyticsLayout: FC = () => {
    return (
        <>
            <GoogleAnalyticsTracker />
            <Outlet />
        </>
    );
};

const router = createBrowserRouter([
    {
        element: <AnalyticsLayout />,
        children: [
            {
                path: "/",
                element: <RootRoute />
            },
            {
                path: "/suggest-callback",
                element: <SuggestCallbackRoute />
            },
            {
                path: "/playground",
                element: <PlaygroundRoute />
            }
        ]
    }
]);

export const AppRoutes: FC = () => {
    return (
        <RouterProvider router={router} />
    )
}
