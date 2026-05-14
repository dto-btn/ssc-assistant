import React from "react";
import { AppBar, Toolbar, Typography, Box, useTheme, Tooltip, IconButton, Button } from "@mui/material";
import { useTranslation } from "react-i18next";
import MenuIcon from "@mui/icons-material/Menu";
import MenuOpenIcon from "@mui/icons-material/MenuOpen";
import CloseIcon from "@mui/icons-material/Close";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import logo from "../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { DevBanner } from "./DevBanner";
import TopmenuMicrosofTeamsIcon from "./TopmenuMicrosofTeamsIcon.svg";
import type { PlaygroundExportFormat } from "../export/sessionExport";

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
  onExport?: (format: PlaygroundExportFormat) => void;
  isExportDisabled?: boolean;
  isExporting?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({
  onToggleSidebar,
  isSidebarOpen,
  isMobile,
  isMobileSidebarOpen,
  onExport,
  isExportDisabled,
  isExporting,
}) => {
  const { t, i18n } = useTranslation(["playground", "translations"]);
  const theme = useTheme();
  const [exportAnchor, setExportAnchor] = React.useState<HTMLElement | null>(null);
  const isExportMenuOpen = Boolean(exportAnchor);

  const handleLanguageToggle = () => {
    const newLang = i18n.language === "en" ? "fr" : "en";
    i18n.changeLanguage(newLang);
  };

  const openExportMenu = (event: React.MouseEvent<HTMLButtonElement>) => {
    setExportAnchor(event.currentTarget);
  };

  const closeExportMenu = () => {
    setExportAnchor(null);
  };

  const handleExportSelect = (format: PlaygroundExportFormat) => {
    closeExportMenu();
    onExport?.(format);
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
                  minWidth: 44,
                  minHeight: 44,
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
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                <CloseIcon />
              </IconButton>
            </Tooltip>
          )}
          <Tooltip
            title={
              isExportDisabled
                ? t("export.disabled.noSession", { ns: "playground", defaultValue: "Select a chat to export" })
                : t("export.label", { ns: "playground", defaultValue: "Export" })
            }
          >
            <span>
              <IconButton
                id="playground-export-button"
                aria-label={t("export.label", { ns: "playground", defaultValue: "Export" })}
                aria-controls={isExportMenuOpen ? "playground-export-menu" : undefined}
                aria-haspopup="menu"
                aria-expanded={isExportMenuOpen}
                onClick={openExportMenu}
                disabled={Boolean(isExportDisabled || isExporting)}
                sx={{
                  color: "white",
                  minWidth: 44,
                  minHeight: 44,
                }}
              >
                <FileDownloadIcon />
              </IconButton>
            </span>
          </Tooltip>
          <Menu
            id="playground-export-menu"
            anchorEl={exportAnchor}
            open={isExportMenuOpen}
            onClose={closeExportMenu}
            MenuListProps={{ "aria-label": t("export.label", { ns: "playground", defaultValue: "Export" }) }}
          >
            <MenuItem onClick={() => handleExportSelect("json")}>
              {t("export.option.json", { ns: "playground", defaultValue: "Export as JSON" })}
            </MenuItem>
            <MenuItem onClick={() => handleExportSelect("pdf")}>
              {t("export.option.pdf", { ns: "playground", defaultValue: "Export as PDF" })}
            </MenuItem>
            <MenuItem onClick={() => handleExportSelect("word")}>
              {t("export.option.word", { ns: "playground", defaultValue: "Export as Word (.docx)" })}
            </MenuItem>
          </Menu>
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
              bgcolor: "white",
              color: "#3f479a",
              textTransform: "none",
              fontWeight: "bold",
              lineHeight: 1.2,
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
                bgcolor: "#f5f5f5",
                color: "#2e3470",
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
            {(i18n.language || "en").toUpperCase()}
          </Button>
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default TopBar;
