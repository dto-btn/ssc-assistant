import React from "react";
import { AppBar, Toolbar, Typography, Box, useTheme, Tooltip, IconButton, Button } from "@mui/material";
import type { PaletteMode } from "@mui/material";
import { useTranslation } from "react-i18next";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import CloseIcon from "@mui/icons-material/Close";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import LightModeIcon from "@mui/icons-material/LightMode";
import logo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { DevBanner } from "./DevBanner";
import TopmenuMicrosofTeamsIcon from "./TopmenuMicrosofTeamsIcon.svg";

/**
 * TopBar component for the playground.
 * Contains the application title, logo, and sidebar toggle button.
 * The sidebar toggle button is shown on mobile and when the sidebar is collapsed on desktop.
 */
interface TopBarProps {
  onToggleSidebar?: () => void;
  isSidebarOpen?: boolean;
  isMobile?: boolean;
  isMobileSidebarOpen?: boolean;
  themeMode: PaletteMode;
  onToggleTheme: () => void;
}

const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  isMobile,
  isMobileSidebarOpen,
  themeMode,
  onToggleTheme,
}) => {
  const { t, i18n } = useTranslation(["playground", "translations"]);
  const theme = useTheme();

  const handleLanguageToggle = () => {
    const newLang = i18n.language === "en" ? "fr" : "en";
    i18n.changeLanguage(newLang);
  };

  return (
    <AppBar
      position="static"
      sx={{
        backgroundColor: "background.paper",
        backgroundImage: "none",
        boxShadow: "none",
        borderBottom: "1px solid",
        borderColor: "divider",
      }}
    >
      <Toolbar
        sx={{
          background:
            themeMode === "dark"
              ? `linear-gradient(45deg, #12141b, ${theme.palette.primary.dark})`
              : `linear-gradient(45deg, #222, ${theme.palette.primary.main})`,
          height: 60,
          minHeight: 60,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1,
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            userSelect: "none",
            flexShrink: 1,
            minWidth: 0,
            overflow: "hidden",
          }}
        >
          {(!isMobile || !isMobileSidebarOpen) && (
            <Tooltip title={isSidebarOpen ? t("sidebar.collapse", { ns: "playground" }) : t("sidebar.open", { ns: "playground" })}>
              <IconButton
                id="playground-open-sidebar-button"
                onClick={onToggleSidebar}
                aria-label={isSidebarOpen ? t("sidebar.collapse", { ns: "playground" }) : t("sidebar.open", { ns: "playground" })}
                aria-expanded={isSidebarOpen}
                aria-controls="playground-session-sidebar"
                sx={{
                  color: "white",
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "2px",
                  },
                }}
              >
                {isSidebarOpen ? <MenuOpenIcon /> : <MenuIcon />}
              </IconButton>
            </Tooltip>
          )}
          <img
            src={logo}
            style={{
              width: "32px",
              height: "auto",
            }}
            alt={t("logo.alt", { ns: "translations", defaultValue: "SSC Logo" })}
          />
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontSize: { xs: "16px", sm: "20px" },
              fontWeight: "500",
              color: "white",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {t("title", { ns: "translations" })}
          </Typography>
          <Box sx={{ display: { xs: "none", sm: "flex" } }}>
            <DevBanner />
          </Box>
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "0.5rem", sm: "1rem" } }}>
          {isMobile && isMobileSidebarOpen && (
            <Tooltip title={t("sidebar.close", { ns: "playground" })}>
              <IconButton
                onClick={onToggleSidebar}
                aria-label={t("sidebar.close", { ns: "playground" })}
                sx={{
                  color: "white",
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "2px",
                  },
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}

          {isMobile && (
            <Tooltip title={themeMode === "dark" ? t("theme.switch.light") : t("theme.switch.dark")}>
              <IconButton
                onClick={onToggleTheme}
                sx={{
                  color: "white",
                  minWidth: "44px",
                  minHeight: "44px",
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "2px",
                  },
                }}
                aria-label={themeMode === "dark" ? t("theme.switch.light") : t("theme.switch.dark")}
              >
                {themeMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          )}

          <Button
            variant="contained"
            disableElevation
            aria-label={t("button.joinchat", { ns: "translations" })}
            onClick={() => {
              window.open(
                "https://teams.microsoft.com/l/channel/19%3Au1yOceUvSm8spn8ZAyma2zT90c042tzBQAwst9Gem1c1%40thread.tacv2/SSC%20Assistant?groupId=9c07bdb4-3403-464b-a1c2-91cdaf3a2496&ngc=true&allowXTenantAccess=true",
                "_blank",
                "noopener,noreferrer"
              );
            }}
            startIcon={<img src={TopmenuMicrosofTeamsIcon} alt="" style={{ width: "1.1rem" }} />}
            sx={{
              bgcolor: themeMode === "dark" ? "#eef2ff" : "white",
              color: themeMode === "dark" ? "#1f2757" : "#3f479a",
              textTransform: "none",
              fontWeight: "bold",
              lineHeight: 1.2,
              border: themeMode === "dark" ? "1px solid rgba(255,255,255,0.14)" : "1px solid transparent",
              borderRadius: "8px",
              padding: { xs: "4px 8px", sm: "6px 16px" },
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
              minHeight: { xs: "44px", sm: "44px" },
              minWidth: { xs: "44px" },
              "& .MuiButton-startIcon": {
                marginRight: { xs: 0, sm: 1 }
              },
              "& .MuiButton-endIcon": {
                display: "none"
              },
              "&:hover": {
                bgcolor: themeMode === "dark" ? "#ffffff" : "#f5f5f5",
                color: themeMode === "dark" ? "#19214d" : "#2e3470",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "2px",
              },
            }}
          >
            <Box component="span" sx={{ display: { xs: "none", sm: "inline" } }}>
              {t("button.joinchat", { ns: "translations" })}
            </Box>
          </Button>

          <Button
            onClick={handleLanguageToggle}
            sx={{
              color: "white",
              minWidth: "44px",
              minHeight: "44px",
              fontWeight: "bold",
              fontSize: { xs: "14px", sm: "16px" },
              "&:hover": {
                bgcolor: "rgba(255, 255, 255, 0.1)",
              },
              "&:focus-visible": {
                outline: "2px solid",
                outlineColor: "primary.main",
                outlineOffset: "2px",
              },
            }}
            aria-label={i18n.language === "en" ? "Passer au français" : "Switch to English"}
          >
            {(i18n.language || "en").toUpperCase()}
          </Button>

          {!isMobile && (
            <Tooltip title={themeMode === "dark" ? t("theme.switch.light") : t("theme.switch.dark")}>
              <IconButton
                onClick={onToggleTheme}
                sx={{
                  color: "white",
                  minWidth: "44px",
                  minHeight: "44px",
                  "&:hover": {
                    bgcolor: "rgba(255, 255, 255, 0.1)",
                  },
                  "&:focus-visible": {
                    outline: "2px solid",
                    outlineColor: "primary.main",
                    outlineOffset: "2px",
                  },
                }}
                aria-label={themeMode === "dark" ? t("theme.switch.light") : t("theme.switch.dark")}
              >
                {themeMode === "dark" ? <LightModeIcon /> : <DarkModeIcon />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
