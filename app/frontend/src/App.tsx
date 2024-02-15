import { Fragment, useEffect, useState } from 'react';
import reactLogo from './assets/react.svg';
import viteLogo from '/vite.svg';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import { purple, pink } from '@mui/material/colors';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import { Alert, Box, Paper, Snackbar, Typography } from '@mui/material';
import { Palette } from '@mui/icons-material';
import { AssistantBubble, UserBubble, TopMenu, ChatInput } from './components';
import { useTranslation } from 'react-i18next';
import { completionMySSC } from './api/api';

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

const welcomeMessage: Completion = {
  message: {
    role: "assistant",
    content: "Hello! I am your SSC Assistant how may I help you today?"
  } as Message
}

export const App = () => {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorSnackbar, setErrorSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [completions, setCompletions] = useState<Completion[]>([welcomeMessage]);

  const makeApiRequest = async (question: string) => {
    // set is loading so we disable some interactive functionality while we load the response
    setIsLoading(true);
    // prepare request bundle
    const request: MessageRequest = {
      query: question
    };

    const userCompletion: Completion = {
      message: {
        role: 'user',
        content: question,
      },
    };

    const responsePlaceholder: Completion = {
      message: {
        role: 'assistant',
        content: '',
      },
    };

    //update current chat window with the message sent..
    setCompletions(prevCompletions => [...prevCompletions, userCompletion, responsePlaceholder]);

    try{
      await completionMySSC({request: request, updateLastMessage: updateLastMessage, updateHistory: updateHistory});
    } catch(error) {
      setErrorSnackbar(true);
      if (error instanceof Error) {
        setErrorMessage(error.message);
      } else {
        setErrorMessage('An unknown error occurred');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const updateLastMessage = (message_chunk: string) => {
    setCompletions((prevCompletions) => {
      const updatedCompletions = [...prevCompletions];//making a copy

      updatedCompletions[updatedCompletions.length-1] = {
        ...updatedCompletions[updatedCompletions.length-1],
        message: {
          ...updatedCompletions[updatedCompletions.length-1].message,
          content: message_chunk,
        },
      }

      return updatedCompletions;
    })
  }

  const updateHistory = () => {};

  const handleCloseSnackbar = (event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setErrorSnackbar(false);
  };

  useEffect(() => {
      // Set the `lang` attribute whenever the language changes
      document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  return (
    <>
      <ThemeProvider theme={mainTheme}>
        <CssBaseline />
        <TopMenu />
        <Box sx={{ display: 'flex', flexFlow: 'column', minHeight: '100vh', margin: 'auto'}} maxWidth="lg">
          <Box sx={{flexGrow: 1}}></Box>
          <Box sx={{ overflowY: 'hidden', padding: '2rem', alignItems: 'flex-end'}}>
            {completions.map( (completion, index) => (
              <Fragment key={index}>
                {completion.message?.role === "assistant" && (
                  <AssistantBubble text={completion.message?.content} />
                )}

                {completion.message?.role === "user" && (
                  <UserBubble text={completion.message?.content} />
                )}
              </Fragment>
            ))}
          </Box>
          <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 1100, bgcolor: 'background.default', padding: '1rem' }}>
            <ChatInput
                clearOnSend
                placeholder={t("placeholder")}
                disabled={isLoading}
                onSend={question => makeApiRequest(question)}/>
          </Box>
        </Box>
        <Snackbar open={errorSnackbar} autoHideDuration={6000} onClose={handleCloseSnackbar} sx={{mb: 1}}>
          <Alert
            onClose={handleCloseSnackbar}
            severity="error"
            variant="filled"
            sx={{ width: '100%' }}
          >
            {errorMessage}
          </Alert>
        </Snackbar>
      </ThemeProvider>
    </>
  )
};
