import { FC } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { RootRoute } from ".";
import { SuggestCallbackRoute } from "./SuggestCallbackRoute";
import PlaygroundRoute from "./PlaygroundRoute";

const router = createBrowserRouter([
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
]);

export const AppRoutes: FC = () => {
    return (
        <RouterProvider router={router} />
    )
}
