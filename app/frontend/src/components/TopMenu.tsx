import MenuIcon from "@mui/icons-material/Menu";
import { Box, Grid, IconButton } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { UserProfilePicture } from './ProfilePicture';
import { useContext } from "react";
import { UserContext } from '../context/UserContext';

const logoStyle = {
  width: "50px",
  height: "auto",
  cursor: "pointer",
};

interface TopMenuProps {
  toggleDrawer: (arg: boolean) => void;
}

export const TopMenu = ({ toggleDrawer } : TopMenuProps) => {
  const { t } = useTranslation();
  const { accessToken, graphData } = useContext(UserContext);

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: "white",
          backgroundImage: "none",
          boxShadow: "none",
          pt: { xs: 0, sm: 2 },
        }}
      >
        <Toolbar
          variant="regular"
          sx={(theme) => ({
            width: { xs: "100%", sm: "95%", xl: "75%" },
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
                ml: { xs: "-18px" },
              }}
              xs={2}
              sm={1}
            >
              <img src={logo} style={logoStyle} alt="logo of SSC" />
            </Grid>
            <Grid item sx={{ display: "flex", flexGrow: 1 }} xs={6} sm={6.5}>
              <Typography variant="h4">{t("title")}</Typography>
            </Grid>
            <Grid container item xs={3} sm={4} sx={{ display: "flex" }} justifyContent='flex-end' alignItems="center">
              {graphData && accessToken && 
              <>
                <Typography variant="body1" mr={2} sx={{ display: { xs: 'none', sm: 'block' } }}>{graphData['givenName']} {graphData['surname']}</Typography>
                <UserProfilePicture fullName={graphData['givenName'] + " " + graphData['surname']} />              </>
             }
            </Grid>
            <Grid container item xs={1} sm={0.5} justifyContent='flex-end' sx={{ml: { xs: "18px" }}}>
              <Box>
                <IconButton
                  edge="start"
                  color="inherit"
                  onClick={() => toggleDrawer(true)}
                  aria-label={t("aria.show.menu")}
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
