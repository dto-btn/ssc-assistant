import { Box, BoxProps } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import AddCommentIcon from "@mui/icons-material/AddComment";
import React from "react";
import { TopMenuFrame } from "./subcomponents/TopMenuFrame";
import TopmenuMicrosofTeamsIcon from "./TopmenuMicrosofTeamsIcon.svg";
import { ProfileMenuButton } from "./subcomponents";

interface TopMenuHomePageProps {
  onNewChat: () => void;
  childrenLeftOfLogo?: React.ReactNode;
  leftOffset?: number;
}

type TopMenuHomePageItem = {
  icon: React.ReactElement;
  label: string;
  extraStyles?: BoxProps;
  onClick: () => void;
};

export const TopMenuHomePage: React.FC<TopMenuHomePageProps> = (({ onNewChat, childrenLeftOfLogo, leftOffset }) => {
  const { t } = useTranslation();

  const topMenuItems: TopMenuHomePageItem[] = [
    {
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
        // "borderColor": "#434bb4"
      }
    },
    {
      icon: <AddCommentIcon sx={{ fontSize: "1.1rem" }} />,
      label: t("new.conversation"),
      onClick: () => {
        onNewChat();
      },
    },
  ];

  return (
    <TopMenuFrame
      childrenLeftOfLogo={childrenLeftOfLogo}
      leftOffset={leftOffset}
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
          {topMenuItems.map((item, index) => (
            <Box
              key={index}
              tabIndex={2}
              sx={{
                transition: "border-color 0.2s",
                display: "flex",
                gap: 0.5,
                alignItems: "center",
                cursor: "pointer",
                border: "2px solid transparent",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.5rem",
                ":hover": {
                  borderColor: "white",
                },
                ...(item.extraStyles || [])
              }}
              onClick={item.onClick}
            >
              {item.icon}
              <Typography
                variant="body1"
                sx={{ display: { xs: "none", lg: "block" } }}
                aria-label={item.label}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            marginLeft: "auto", // make it float to the right
          }}
        >
          <ProfileMenuButton
            size="30px"
            fontSize="12px"
          />

        </Box>
      </Box>
    </TopMenuFrame>
  );
});
