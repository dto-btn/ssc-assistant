import AppBar from '@mui/material/AppBar';
import Box from '@mui/material/Box';
import Container from '@mui/material/Container';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';
import Cookies from "js-cookie";
import { useTranslation } from 'react-i18next';
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";

const logoStyle = {
  width: '50px',
  height: 'auto',
  cursor: 'pointer',
};

export const TopMenu = () => {

  const { t, i18n } = useTranslation();

  const setTranslationCookie = () => {
      Cookies.set("lang_setting", i18n.language, {
          expires: 30,
      });
  };

  const changeLanguage = (lng: string) => {
      i18n.changeLanguage(lng);
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
            <Box
              sx={{
                flexGrow: 1,
                display: 'flex',
                alignItems: 'center',
                ml: '-18px',
                px: 0,
              }}
            >
              <img
                src={logo}
                style={logoStyle}
                alt="logo of SSC"
              />
              <Typography variant="h6" component="div" sx={{paddingLeft: "0.75em",}}>
                {t('title')}
              </Typography>
            </Box>
            <Link href="#" onClick={() => {changeLanguage(t("langlink.shorthand")); setTranslationCookie();}} color="inherit">{t("langlink")}</Link>
            {/* <IconButton color="inherit">?</IconButton> */}
          </Toolbar>
        </Container>
      </AppBar>
    </>
  );
};
