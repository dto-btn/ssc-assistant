import React from "react";
import { Box, ButtonBase, Typography, Tooltip } from "@mui/material";
import LightModeIcon from "@mui/icons-material/LightMode";
import DarkModeIcon from "@mui/icons-material/DarkMode";
import { useTranslation } from "react-i18next";
import { usePlaygroundTheme } from "../theme/themeContext";

const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = usePlaygroundTheme();
  const { t } = useTranslation("playground");
  const isDarkMode = theme === "dark";

  return (
    <Tooltip title={t("theme.toggle.label") ?? "Toggle color theme"} placement="top">
      <ButtonBase
        onClick={toggleTheme}
        role="switch"
        aria-checked={isDarkMode}
        aria-pressed={isDarkMode}
        aria-label={isDarkMode ? t("theme.toggle.dark") : t("theme.toggle.light")}
        sx={{
          width: "100%",
          borderRadius: 999,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          px: 1.5,
          py: 0.75,
          backgroundColor: "var(--pg-toggle-bg)",
          border: "1px solid var(--pg-border-strong)",
          color: "var(--pg-toggle-text)",
          transition: "background-color 0.2s ease, border-color 0.2s ease",
          "&:focus-visible": {
            outline: "3px solid var(--pg-focus-ring)",
            outlineOffset: 2,
          },
        }}
      >
        <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <LightModeIcon
            fontSize="small"
            sx={{
              color: isDarkMode ? "var(--pg-text-muted)" : "var(--pg-toggle-icon)",
              opacity: isDarkMode ? 0.65 : 1,
            }}
            aria-hidden="true"
          />
          <Typography variant="body2" fontWeight={600} sx={{ color: "var(--pg-toggle-text)" }}>
            {isDarkMode ? t("theme.toggle.dark") : t("theme.toggle.light")}
          </Typography>
        </Box>
        <DarkModeIcon
          fontSize="small"
          sx={{
            color: isDarkMode ? "var(--pg-toggle-icon)" : "var(--pg-text-muted)",
            opacity: isDarkMode ? 1 : 0.65,
          }}
          aria-hidden="true"
        />
      </ButtonBase>
    </Tooltip>
  );
};

export default ThemeToggle;
