import MenuIcon from "@mui/icons-material/Menu";
import { Box, Grid, IconButton } from "@mui/material";
import AppBar from "@mui/material/AppBar";
import Toolbar from "@mui/material/Toolbar";
import Typography from "@mui/material/Typography";
import { useTranslation } from "react-i18next";
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { Grid, Stack } from '@mui/material';
import { useIsAuthenticated } from "@azure/msal-react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import { useEffect, useState } from 'react';
import { callMsGraph } from '../graph';
import { UserProfilePicture } from './ProfilePicture';

const logoStyle = {
  width: "50px",
  height: "auto",
  cursor: "pointer",
};

interface TopMenuProps {
  toggleDrawer: (arg: boolean) => void;
}

export const TopMenu = ({ toggleDrawer } : TopMenuProps) => {
  const isAuthenticated = useIsAuthenticated();
  const { instance, accounts } = useMsal();
  const [graphData, setGraphData] = useState(null);
  const { t, i18n } = useTranslation();
  const [ accessToken, setAccessToken ] = useState<string>("");

  const setTranslationCookie = () => {
      Cookies.set("lang_setting", i18n.language, {
          expires: 30,
      });
  };

  const changeLanguage = (lng: string) => {
      i18n.changeLanguage(lng);
  };

  const handleLogin = () => {
    instance.loginRedirect(loginRequest).catch((e) => {
      console.log(e);
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      // If the user is authenticated, you might want to acquire a token silently
      // or handle the logged-in user's information here.
      instance.acquireTokenSilent({
        ...loginRequest,
        account: accounts[0],
      }).then((response) => {
        setAccessToken(response.accessToken);
        callMsGraph(response.accessToken).then((response) => setGraphData(response));
      }).catch(error => {
        // Handle error, for example, by acquiring token interactively
        console.log("unable to get user graph information ...", error);
      });
    }
  }, [isAuthenticated, instance, accounts]);

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
            <Grid container item xs={6} sm={4} justifyContent='flex-end'>
              {isAuthenticated && graphData && accessToken ? <Stack  direction="row" spacing={2}><UserProfilePicture accessToken={accessToken} username={graphData['givenName'] + " " + graphData['surname']} /><b>{graphData['givenName']} {graphData['surname']}</b></Stack> : <Link href="#" onClick={() => {handleLogin()}} color="inherit">{t("login")}</Link>}
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
