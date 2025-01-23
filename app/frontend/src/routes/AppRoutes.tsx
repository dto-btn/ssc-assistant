import { FC } from "react";
import { BrowserRouter, Routes, Route } from "react-router";
import MainScreen from "../screens/MainScreen";
import { RootRoute } from ".";
import { AdminRoute } from "./admin";

export const AppRoutes: FC = () => {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<RootRoute />} />
                <Route path="/admin" element={<AdminRoute />} />
            </Routes>
        </BrowserRouter>
    )
}
