import { useEffect, useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import './App.css';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { purple, pink } from '@mui/material/colors';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { Box, Paper, Typography } from '@mui/material';
import { Palette } from '@mui/icons-material';
import { AssistantBubble, UserBubble, TopMenu, ChatInput } from './components';
import { useTranslation } from 'react-i18next';

const mainTheme = createTheme({
  palette: {
    primary: {
      main: "#4c3e99",
    },
    secondary: {
      main: "#f33aea",
    },
    background: {
      default: '#f2f2f2',
    }
  },

});

export const App = () => {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const makeApiRequest = async (question: string) => {alert(question);};

  useEffect(() => {
      // Set the `lang` attribute whenever the language changes
      document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <>
      <ThemeProvider theme={mainTheme}>
        <CssBaseline />
        <TopMenu />
        <Box sx={{ display: 'flex', flexFlow: 'column', minHeight: '100vh'}}>
          <Box sx={{flexGrow: 1}}></Box>
          <Box sx={{ overflowY: 'hidden', padding: '2rem', alignItems: 'flex-end'}}>
            <AssistantBubble text="Hello Guillaume Turcotte, how can I help you?" />
            <UserBubble text="I'm looking for information on chat bubbles." />
            <AssistantBubble text="Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum." />
          </Box>
          <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 1100, bgcolor: 'background.default', padding: '1rem' }}>
            <ChatInput 
                clearOnSend
                placeholder={t("placeholder")}
                disabled={isLoading}
                onSend={question => makeApiRequest(question)}/>
          </Box>
        </Box>
      </ThemeProvider>
    </>
  )
};
