import React from "react";
import { AppBar, Toolbar, Typography, Box, useTheme, Tooltip, IconButton, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
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
}

const TopBar: React.FC<TopBarProps> = ({ onToggleSidebar, isSidebarOpen }) => {
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
            flexShrink: 0,
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
            alt={t("logo.alt", { ns: "translations", defaultValue: "SSC Logo" })}
          />
          <Typography
            variant="h6"
            component="h1"
            sx={{
              fontSize: { xs: "16px", sm: "20px" },
              fontWeight: "500",
              color: "white",
              textWrap: "nowrap",
            }}
          >
            {t("title", { ns: "translations" })}
          </Typography>
          <DevBanner />
        </Box>

        <Box sx={{ display: "flex", alignItems: "center", gap: { xs: "0.5rem", sm: "1rem" } }}>
          <Button
            variant="contained"
            disableElevation
            onClick={() => {
              window.open("https://teams.microsoft.com/l/channel/19%3Au1yOceUvSm8spn8ZAyma2zT90c042tzBQAwst9Gem1c1%40thread.tacv2/SSC%20Assistant?groupId=9c07bdb4-3403-464b-a1c2-91cdaf3a2496&ngc=true&allowXTenantAccess=true", "_blank");
            }}
            startIcon={<img src={TopmenuMicrosofTeamsIcon} alt="" style={{ width: "1.1rem" }} />}
            sx={{
              bgcolor: "white",
              color: "#7a81eb",
              textTransform: "none",
              fontWeight: "bold",
              lineHeight: 1.2,
              borderRadius: "8px",
              padding: { xs: "4px 8px", sm: "6px 16px" },
              fontSize: { xs: "0.75rem", sm: "0.875rem" },
              minHeight: { xs: "32px", sm: "36px" },
              "& .MuiButton-startIcon": {
                marginRight: { xs: 0, sm: 1 }
              },
              "& .MuiButton-endIcon": {
                display: "none"
              },
              "&:hover": {
                bgcolor: "#f5f5f5",
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
            }}
            aria-label={i18n.language === "en" ? "Passer au français" : "Switch to English"}
          >
            {i18n.language.toUpperCase()}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
