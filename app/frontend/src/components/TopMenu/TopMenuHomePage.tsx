import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import React from "react";
import FileDownloadIcon from "@mui/icons-material/FileDownload";
import Menu from "@mui/material/Menu";
import MenuItem from "@mui/material/MenuItem";
import Tooltip from "@mui/material/Tooltip";
import IconButton from "@mui/material/IconButton";
import { TopMenuFrame } from "./subcomponents/TopMenuFrame";
import TopmenuMicrosofTeamsIcon from "./TopmenuMicrosofTeamsIcon.svg";
import { ProfileMenuButton } from "./subcomponents/ProfileMenuButton";
import { TopMenuItem } from "./subcomponents/TopMenuItem";
import type { PlaygroundExportFormat } from "../../playground/export/sessionExport";

interface TopMenuHomePageProps {
  childrenLeftOfLogo?: React.ReactNode;
  enabledTools: Record<string, boolean>;
  handleUpdateEnabledTools: (
    name: string
  ) => void;
  selectedModel: string;
  handleSelectedModelChanged: (modelName: string) => void;
  logout: () => void;
  onExport?: (format: PlaygroundExportFormat) => void;
  isExportDisabled?: boolean;
  isExporting?: boolean;
}


export const TopMenuHomePage: React.FC<TopMenuHomePageProps> = (({
  childrenLeftOfLogo,
  enabledTools,
  handleUpdateEnabledTools,
  selectedModel,
  handleSelectedModelChanged,
  logout,
  onExport,
  isExportDisabled,
  isExporting,
}) => {
  const { t } = useTranslation();
  const [exportAnchor, setExportAnchor] = React.useState<HTMLElement | null>(null);
  const isExportMenuOpen = Boolean(exportAnchor);

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
    <TopMenuFrame
      childrenLeftOfLogo={childrenLeftOfLogo}
    >
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          userSelect: "none",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            userSelect: "none",
          }}
        >

        </Box>
        <Box
          sx={{
            marginLeft: "auto", // make it float to the right
            display: "flex",
            gap: "1rem",
            alignItems: "center",
          }}
        >
          <Tooltip
            title={
              isExportDisabled
                ? t("export.disabled.noSession")
                : t("export.label")
            }
          >
            <span>
              <IconButton
                id="legacy-export-button"
                aria-label={t("export.label")}
                aria-controls={isExportMenuOpen ? "legacy-export-menu" : undefined}
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
            id="legacy-export-menu"
            anchorEl={exportAnchor}
            open={isExportMenuOpen}
            onClose={closeExportMenu}
            MenuListProps={{ "aria-label": t("export.label") }}
          >
            <MenuItem onClick={() => handleExportSelect("json")}>{t("export.option.json")}</MenuItem>
            <MenuItem onClick={() => handleExportSelect("pdf")}>{t("export.option.pdf")}</MenuItem>
            <MenuItem onClick={() => handleExportSelect("word")}>{t("export.option.word")}</MenuItem>
          </Menu>
          <TopMenuItem item={{
            id: "topmenu-join-teams",
            icon: <img src={TopmenuMicrosofTeamsIcon} alt="Teams" style={{ width: "1.1rem" }} />,
            label: t("button.joinchat"),
            onClick: () => {
              // open microsoft.com in a new tab
              window.open("https://teams.microsoft.com/l/channel/19%3Au1yOceUvSm8spn8ZAyma2zT90c042tzBQAwst9Gem1c1%40thread.tacv2/SSC%20Assistant?groupId=9c07bdb4-3403-464b-a1c2-91cdaf3a2496&ngc=true&allowXTenantAccess=true", "_blank");
            },
            extraStyles: {
              "bgcolor": "white",
              "color": "#7a81eb",
              padding: "0rem 1rem",
            }
          }} />
          <ProfileMenuButton
            size="30px"
            fontSize="12px"
            enabledTools={enabledTools}
            handleUpdateEnabledTools={handleUpdateEnabledTools}
            selectedModel={selectedModel}
            handleSelectedModelChanged={handleSelectedModelChanged}
            logout={logout}
          />

        </Box>
      </Box>
    </TopMenuFrame>
  );
});
