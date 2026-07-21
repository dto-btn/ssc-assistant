import { Box } from "@mui/material";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import logo from "../../../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { type PropsWithChildren } from "react";
import { type FC } from "react";
import { AppBar } from "../../layouts/NewLayout/components/AppBar";
import { useAppStore } from "../../../stores/AppStore";
import { LEFT_MENU_WIDTH } from "../../../constants";
import { DevBanner } from "../../DevBanner";

type TopMenuProps = PropsWithChildren<{
  childrenLeftOfLogo?: React.ReactNode;
}>;
export const TopMenuFrame: FC<TopMenuProps> = ({
  children,
  childrenLeftOfLogo,
}) => {
  const { t } = useTranslation();
  const { appDrawer } = useAppStore();
  const isOpen = appDrawer.isOpen;

  return (
    <>
      <AppBar
        position="fixed"
        isOpen={isOpen}
        drawerWidth={LEFT_MENU_WIDTH}
        sx={{
          display: "inline-block",
          bgcolor: "white",
          backgroundImage: "none",
          boxShadow: "none",
          position: "fixed",
          left: 0,
          top: 0,
          right: 0,
          width: `calc(100vw - ${isOpen ? LEFT_MENU_WIDTH : 0}px)`,
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
        }}
      >
        <Toolbar
          variant="dense"
          sx={(theme) => ({
            width: "100%",
            margin: "auto",
            display: "flex",
            gap: "1rem",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
            flexWrap: "nowrap",
            borderRadius: 0,
            background: `linear-gradient(45deg, #222, ${theme.palette.primary.main})`,
            maxHeight: 40,
            border: "none",
            overflowX: "auto",
            overflowY: "hidden",
          })}
        >
          {childrenLeftOfLogo}
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              userSelect: "none",
              minWidth: 0,
              whiteSpace: "nowrap",
            }}
          >
            <img
              src={logo}
              style={{
                width: "35px",
                height: "auto",
              }}
              alt="logo of SSC"
            />
            <Typography
              variant="h1"
              sx={{ fontSize: "20px", fontWeight: "500", textWrap: "nowrap" }}
            >
              {t("title")}
            </Typography>
            <DevBanner />
          </Box>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              gap: "1rem",
              justifyContent: "space-between",
              flexGrow: 1,
              minWidth: 0,
              overflowX: "auto",
              whiteSpace: "nowrap",
            }}
          >
            {/* This is where the content will go. */}
            {children}
          </Box>
        </Toolbar>
      </AppBar>
    </>
  );
};
