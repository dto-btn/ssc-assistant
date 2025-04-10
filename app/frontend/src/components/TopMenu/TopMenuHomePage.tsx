import MenuIcon from "@mui/icons-material/Menu";
import { Box, IconButton } from "@mui/material";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import { UserProfilePicture } from "../ProfilePicture";
import { useContext } from "react";
import { UserContext } from "../../context/UserContext";
import { forwardRef } from "react";
import AddCommentIcon from "@mui/icons-material/AddComment";
import React from "react";
import { TopMenuFrame } from "./subcomponents/TopMenuFrame";

interface TopMenuHomePageProps {
  toggleDrawer: (arg: boolean) => void;
  ref: React.RefObject<HTMLButtonElement>;
  onNewChat: () => void;
}

type TopMenuHomePageItem = {
  icon: React.ReactElement;
  label: string;
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
