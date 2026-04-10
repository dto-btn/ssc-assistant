import React from "react";
import { AppBar, Toolbar, Typography, Box, useTheme, Tooltip, IconButton } from "@mui/material";
import { useTranslation } from "react-i18next";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import logo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { DevBanner } from "./DevBanner";

/**
 * TopBar component for the playground.
 * Contains the application title, logo, and sidebar toggle button.
 * The sidebar toggle button is shown on mobile and when the sidebar is collapsed on desktop.
 */
interface TopBarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
  const { t } = useTranslation(["playground", "translations"]);
  const theme = useTheme();

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: "white",
        backgroundImage: "none",
        boxShadow: "none",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar
        sx={{
          background: `linear-gradient(45deg, #222, ${theme.palette.primary.main})`,
          height: 60,
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          px: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            userSelect: "none",
          }}
        >
          <Tooltip title={isSidebarOpen ? t("sidebar.collapse", { ns: "playground" }) : t("sidebar.open", { ns: "playground" })}>
            <IconButton
              onClick={onToggleSidebar}
              aria-label={isSidebarOpen ? t("sidebar.collapse", { ns: "playground" }) : t("sidebar.open", { ns: "playground" })}
              aria-expanded={isSidebarOpen}
              sx={{ color: "white" }}
            >
              {isSidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
            </IconButton>
          </Tooltip>
          <img
            src={logo}
            style={{
              width: "32px",
              height: "auto",
            }}
            alt="SSC Logo"
          />
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontSize: "20px",
              fontWeight: "500",
              color: "white",
              textWrap: "nowrap",
            }}
          >
            {t("title", { ns: "translations" })}
          </Typography>
          <DevBanner />
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
