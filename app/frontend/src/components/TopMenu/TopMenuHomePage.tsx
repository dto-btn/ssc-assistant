import { Box } from "@mui/material";
import { useTranslation } from "react-i18next";
import React from "react";
import { TopMenuFrame } from "./subcomponents/TopMenuFrame";
import TopmenuMicrosofTeamsIcon from "./TopmenuMicrosofTeamsIcon.svg";
import { ProfileMenuButton } from "./subcomponents";
import { TopMenuItem } from "./subcomponents/TopMenuItem";

interface TopMenuHomePageProps {
  childrenLeftOfLogo?: React.ReactNode;
  enabledTools: Record<string, boolean>;
  handleSetSelectedCorporateFunction: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  selectedCorporateFunction: string;
  handleUpdateEnabledTools: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  selectedModel: string;
  handleSelectedModelChanged: (modelName: string) => void;
}


export const TopMenuHomePage: React.FC<TopMenuHomePageProps> = (({
  childrenLeftOfLogo,
  enabledTools,
  handleSetSelectedCorporateFunction,
  selectedCorporateFunction,
  handleUpdateEnabledTools,
  selectedModel,
  handleSelectedModelChanged
}) => {
  const { t } = useTranslation();

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
            gap: "2rem",
          }}
        >
          <TopMenuItem item={{
            // icon: <AddCommentIcon sx={{ fontSize: "1.1rem" }} />,
            icon: <img src={TopmenuMicrosofTeamsIcon} alt="Teams" style={{ width: "1.1rem" }} />,
            label: t("button.joinchat"),
            onClick: () => {
              // onNewChat();
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
            handleSetSelectedCorporateFunction={handleSetSelectedCorporateFunction}
            selectedCorporateFunction={selectedCorporateFunction}
            handleUpdateEnabledTools={handleUpdateEnabledTools}
            selectedModel={selectedModel}
            handleSelectedModelChanged={handleSelectedModelChanged}
          />

        </Box>
      </Box>
    </TopMenuFrame>
  );
});
