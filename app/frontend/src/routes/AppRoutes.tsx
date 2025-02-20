import { FC } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import { RootRoute } from ".";
import { AdminRoute } from "./admin";
import { SuggestCallbackRoute } from "./SuggestCallbackRoute";

export const AppRoutes: FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<RootRoute />} />
                <Route path="/admin" element={<AdminRoute />} />
                <Route path="/suggest-callback" element={<SuggestCallbackRoute />} />
            </Routes>
        </BrowserRouter>
    )
}
