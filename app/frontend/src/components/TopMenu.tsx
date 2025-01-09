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
import { forwardRef } from "react";
import React from "react";

interface TopMenuProps {
  toggleDrawer: (arg: boolean) => void;
  ref: React.RefObject<HTMLButtonElement>;
}

export const TopMenu = forwardRef<HTMLButtonElement, TopMenuProps>(({ toggleDrawer }, ref) => {
  const { t } = useTranslation();
  const { graphData } = useContext(UserContext);

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          bgcolor: "white",
          backgroundImage: "none",
          boxShadow: "none"
        }}
      >
        <Toolbar
          variant="dense"
          sx={(theme) => ({
            width: "100%",
            margin: "auto",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            borderRadius: 0,
            background: `linear-gradient(45deg, black, ${theme.palette.primary.main})`,
            maxHeight: 40,
            border: "none"
          })}
        >
          <Box sx={{
            display: "flex",
            alignItems: "center",
            gap: "1rem",
            cursor: "pointer",
            userSelect: "none"
          }}>
            <img src={logo} style={{
              width: "35px",
              height: "auto",
            }} alt="logo of SSC" />
            <Typography variant="h1" sx={{ fontSize: '20px', fontWeight: '500' }}>{t("title")}</Typography>
          </Box>
          <Box sx={{
            display: "flex",
            flexGrow: 1,
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "1rem",
          }}>
            {graphData &&
              <>
                <Typography variant="body1" sx={{ display: { xs: 'none', sm: 'block' } }}>{graphData['givenName']} {graphData['surname']}</Typography>
                <UserProfilePicture fullName={graphData['givenName'] + " " + graphData['surname']} size="30px" fontSize="12px" />
              </>
            }
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

          {/* <Grid container alignItems="center">
            <Grid
              item
              sx={{
                ml: { xs: "-18px" },
              }}
              xs={0}
              sm={1}
            >
              &nbsp;
            </Grid>
            <Grid item sx={{ display: "flex", flexGrow: 1, alignItems: "center", gap: "1rem" }} xs={6} sm={6.5}>
              <img src={logo} style={{
                width: "35px",
                height: "auto",
                cursor: "pointer",
              }} alt="logo of SSC" />
              <Typography variant="h1" sx={{ fontSize: '20px', fontWeight: '500' }}>{t("title")}</Typography>
            </Grid>
            <Grid container item xs={3} sm={4} sx={{ display: "flex" }} justifyContent='flex-end' alignItems="center">
              {graphData &&
                <>
                  <Typography variant="body1" mr={2} sx={{ display: { xs: 'none', sm: 'block' } }}>{graphData['givenName']} {graphData['surname']}</Typography>
                  <UserProfilePicture fullName={graphData['givenName'] + " " + graphData['surname']} size="30px" fontSize="12px" />
                </>
              }
            </Grid>
            <Grid container item xs={1} sm={0.5} justifyContent='flex-end' sx={{ ml: { xs: "18px" } }}>
              <Box>
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
            </Grid>
          </Grid> */}
        </Toolbar>
      </AppBar >
    </>
  );
});
