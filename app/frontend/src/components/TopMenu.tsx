import MenuIcon from "@mui/icons-material/Menu";
import { Box, Grid, IconButton } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Link from "@mui/material/Link";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";

const logoStyle = {
  width: "50px",
  height: "auto",
  cursor: "pointer",
};

interface TopMenuProps {
  toggleDrawer: (arg: boolean) => void;
  setLangCookie: () => void;
}

export const TopMenu = ({ toggleDrawer, setLangCookie } : TopMenuProps) => {
  const { t, i18n } = useTranslation();

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
  };

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: "transparent",
          backgroundImage: "none",
          boxShadow: "none",
          mt: { xs: 0, sm: 2 },
        }}
      >
        <Toolbar
          variant="regular"
          sx={(theme) => ({
            width: { xs: "100%", sm: "75%" },
            margin: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "32px",
            flexShrink: 0,
            borderRadius: { xs: 0, sm: 999 },
            background: `linear-gradient(45deg, black, ${theme.palette.primary.main})`,
            maxHeight: 40,
            border: { xs: "none", sm: "1px solid" },
            borderColor: "black",
            boxShadow:
              theme.palette.mode === "light"
                ? `0 0 1px rgba(85, 166, 246, 0.1), 1px 1.5px 2px -1px rgba(85, 166, 246, 0.15), 4px 4px 12px -2.5px rgba(85, 166, 246, 0.15)`
                : "0 0 1px rgba(2, 31, 59, 0.7), 1px 1.5px 2px -1px rgba(2, 31, 59, 0.65), 4px 4px 12px -2.5px rgba(2, 31, 59, 0.65)",
          })}
        >
          <Grid container alignItems="center">
            <Grid
              item
              sx={{
                flexGrow: 1,
                display: "flex",
                alignItems: "center",
                ml: { xs: "-24px", sm: "-18px" },
                pr: "18px",
              }}
              xs={3}
              sm={1}
            >
              <img src={logo} style={logoStyle} alt="logo of SSC" />
            </Grid>
            <Grid item sx={{ display: "flex" }} xs={6} sm={9}>
              <Typography variant="h6">{t("title")}</Typography>
            </Grid>
            <Grid item xs={3} sm={2} justifyContent="right">
              <Box
                sx={{
                  position: "fixed",
                  top: { xs: 12, sm: 29 },
                  right: { xs: 12, sm: "14%" },
                }}
              >
                <IconButton
                  edge="start"
                  color="inherit"
                  onClick={() => toggleDrawer(true)}
                >
                  <MenuIcon />
                </IconButton>
              </Box>
            </Grid>
          </Grid>
        </Toolbar>
      </AppBar>
    </>
  );
};
