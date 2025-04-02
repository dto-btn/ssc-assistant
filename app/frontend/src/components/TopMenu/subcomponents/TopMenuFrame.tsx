import { Box } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import logo from "../../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { type PropsWithChildren } from "react";
import { type FC } from "react";

type TopMenuProps = PropsWithChildren<{
    childrenLeftOfLogo?: React.ReactNode;
    leftOffset?: number
}>;
export const TopMenuFrame: FC<TopMenuProps> = (({ children, childrenLeftOfLogo, leftOffset }) => {
    const { t } = useTranslation();

    return (
        <>
            <AppBar
                sx={{
                    display: "inline-block",
                    bgcolor: "white",
                    backgroundImage: "none",
                    boxShadow: "none",
                    position: "fixed",
                    left: leftOffset || 0,
                    top: 0,
                    right: 0,
                    width: `calc(100vw - ${leftOffset || 0}px)`,
                }}
            >
                <Toolbar
                    variant="dense"
                    sx={(theme) => ({
                        width: "100%",
                        margin: "auto",
                        display: "flex",
                        gap: "3rem",
                        alignItems: "center",
                        justifyContent: "space-between",
                        flexShrink: 0,
                        borderRadius: 0,
                        background: `linear-gradient(45deg, #222, ${theme.palette.primary.main})`,
                        maxHeight: 40,
                        border: "none"
                    })}
                >
                    {childrenLeftOfLogo}
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        userSelect: "none",
                    }}>
                        <img src={logo} style={{
                            width: "35px",
                            height: "auto",
                        }} alt="logo of SSC" />
                        <Typography variant="h1" sx={{ fontSize: '20px', fontWeight: '500' }}>{t("title")}</Typography>
                    </Box>
                    <Box sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: "1rem",
                        justifyContent: "space-between",
                        flexGrow: 1,
                    }}>
                        {/* This is where the content will go. */}
                        {children}
                    </Box>
                </Toolbar>
            </AppBar >
        </>
    );
});
