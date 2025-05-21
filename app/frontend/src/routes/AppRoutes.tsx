import { FC } from "react";
import { createBrowserRouter, RouterProvider } from "react-router";
import { RootRoute } from ".";
import { AdminRoute } from "./admin";
import { SuggestCallbackRoute } from "./SuggestCallbackRoute";
import NewLayoutRoute from "./NewLayoutRoute";
import { BitsQueryRoute } from "./bits-query";
import { FrontendChatTestScreen } from '../screens/FrontendChatTestScreen';

const router = createBrowserRouter([
    {
        path: "/",
        element: <RootRoute />
    },
    {
        path: "/admin",
        element: <AdminRoute />
    },
    {
        path: "/suggest-callback",
        element: <SuggestCallbackRoute />
    },
    {
        path: "/new-layout",
        element: <NewLayoutRoute />
    },
    {
        path: "/bits-query",
        element: <BitsQueryRoute />
    },
    {
        path: "/frontend-chat-test-screen",
        element: <FrontendChatTestScreen />
    }
]);

export const AppRoutes: FC = () => {
    return (
        <RouterProvider router={router} />
    )
}
