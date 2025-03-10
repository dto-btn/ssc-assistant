import MenuIcon from "@mui/icons-material/Menu";
import { Box, BoxProps, IconButton } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { UserProfilePicture } from "../ProfilePicture";
import { useContext } from "react";
import { UserContext } from "../../context/UserContext";
import { forwardRef } from "react";
import AddCommentIcon from "@mui/icons-material/AddComment";
import React from "react";
import { TopMenuFrame } from "./subcomponents/TopMenuFrame";
import TopmenuMicrosofTeamsIcon from "./TopmenuMicrosofTeamsIcon.svg";

interface TopMenuHomePageProps {
  toggleDrawer: (arg: boolean) => void;
  ref: React.RefObject<HTMLButtonElement>;
  onNewChat: () => void;
}

type TopMenuHomePageItem = {
  icon: React.ReactElement;
  label: string;
  extraStyles?: BoxProps;
  onClick: () => void;
};

export const TopMenuHomePage = forwardRef<
  HTMLButtonElement,
  TopMenuHomePageProps
>(({ toggleDrawer, onNewChat }, ref) => {
  const { t } = useTranslation();
  const { graphData } = useContext(UserContext);

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
    <TopMenuFrame>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          width: "100%",
          cursor: "pointer",
          userSelect: "none",
        }}
      >
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          {topMenuItems.map((item, index) => (
            <Box
              key={index}
              tabIndex={0}
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
                sx={{ display: { xs: "none", md: "block" } }}
                aria-label={item.label}
              >
                {item.label}
              </Typography>
            </Box>
          ))}
        </Box>
        <Box
          sx={{
            display: "flex",
            flexGrow: 1,
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "1rem",
          }}
        >
          {graphData && (
            <>
              <Typography
                variant="body1"
                sx={{ display: { xs: "none", md: "block" } }}
              >
                {graphData["givenName"]} {graphData["surname"]}
              </Typography>
              <UserProfilePicture
                fullName={graphData["givenName"] + " " + graphData["surname"]}
                size="30px"
                fontSize="12px"
              />
            </>
          )}
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => toggleDrawer(true)}
            aria-label={t("aria.show.menu")}
            ref={ref}
          >
            <MenuIcon />
          </IconButton>
        </Box>
      </Box>
    </TopMenuFrame>
  );
});
