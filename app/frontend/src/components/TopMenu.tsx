import AppBar from '@mui/material/AppBar';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Cookies from "js-cookie";
import { useTranslation } from 'react-i18next';
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { Grid } from '@mui/material';
import { useIsAuthenticated } from "@azure/msal-react";
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";

const logoStyle = {
  width: '50px',
  height: 'auto',
  cursor: 'pointer',
};

export const TopMenu = () => {
  const isAuthenticated = useIsAuthenticated();
  const { instance } = useMsal();
  const { t, i18n } = useTranslation();

  const setTranslationCookie = () => {
      Cookies.set("lang_setting", i18n.language, {
          expires: 30,
      });
  };

  const changeLanguage = (lng: string) => {
      i18n.changeLanguage(lng);
  };

  const handleLogin = (loginType: string) => {
    if (loginType === "popup") {
      instance.loginPopup(loginRequest).catch((e) => {
        console.log(e);
      });
    } else if (loginType === "redirect") {
      instance.loginRedirect(loginRequest).catch((e) => {
        console.log(e);
      });
    }
  };

  return (
    <>
      <AppBar position="fixed"
              sx={{
                boxShadow: 0,
                bgcolor: 'transparent',
                backgroundImage: 'none',
                mt: 2,
              }}>
        <Container maxWidth="lg">
          <Toolbar 
            variant='regular'
            sx={(theme) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              borderRadius: '999px',
              background: `linear-gradient(45deg, black, ${theme.palette.primary.main})`,
              backdropFilter: 'blur(24px)',
              maxHeight: 40,
              border: '1px solid',
              borderColor: 'black',
              boxShadow:
                theme.palette.mode === 'light'
                  ? `0 0 1px rgba(85, 166, 246, 0.1), 1px 1.5px 2px -1px rgba(85, 166, 246, 0.15), 4px 4px 12px -2.5px rgba(85, 166, 246, 0.15)`
                  : '0 0 1px rgba(2, 31, 59, 0.7), 1px 1.5px 2px -1px rgba(2, 31, 59, 0.65), 4px 4px 12px -2.5px rgba(2, 31, 59, 0.65)',
            })}
          >
            <Grid container alignItems="center" spacing={2}>
              <Grid item sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                ml: '-18px',
                pr: '18px',
              }} xs={4} sm={1}>
                <img
                  src={logo}
                  style={logoStyle}
                  alt="logo of SSC"
                />
              </Grid>
              <Grid item sx={{ display: { xs: 'none', sm: 'flex'}}} sm={8}>
                <Typography variant="h6">
                  {t('title')}
                </Typography>
              </Grid>
              <Grid item xs={6} sm={2}>
                {isAuthenticated ? <div>Yes</div> : <Link href="#" onClick={() => {handleLogin("redirect")}} color="inherit">Login!</Link>}
              </Grid>
              <Grid item xs={2} sm={1} justifyContent='right'>
                <Link href="#" onClick={() => {changeLanguage(t("langlink.shorthand")); setTranslationCookie();}} color="inherit">{t("langlink")}</Link>
              </Grid>
            </Grid>
          </Toolbar>
        </Container>
      </AppBar>
    </>
  );
};
