import { Alert, Box, FormControl, FormControlLabel, FormLabel, Grid, Radio, RadioGroup, Snackbar, Typography } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import { ChangeEvent, Fragment, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { completionMySSC } from './api/api';
import { AssistantBubble, ChatInput, TopMenu, UserBubble, Disclaimer} from './components';

const mainTheme = createTheme({
  palette: {
    primary: {
      main: "#4b3e99", /* SSC's official colour code I found using our chatbot! XD */
    },
    secondary: {
      main: "#f33aea",
    },
    background: {
      default: '#f2f2f2',
    }
  },
});

export const enum ChatWith {
  Data = "data",
  Tools = "tools"
};

export const App = () => {
  const { t, i18n } = useTranslation();
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorSnackbar, setErrorSnackbar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [maxMessagesSent] = useState<number>(10);
  const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
  const [chatWith, setChatWith] = useState<ChatWith>(ChatWith.Data);

  const welcomeMessage: Completion = {
    message: {
      role: "assistant",
      content: t('default.welcome.msg')
    } as Message
  }

  const [completions, setCompletions] = useState<Completion[]>([welcomeMessage]);

  const convertCompletionsToMessages = (completions: Completion[]): Message[] => {
    // Calculate the start index to slice from if the array length exceeds maxMessagesSent
    const startIndex = Math.max(completions.length - maxMessagesSent, 0);
    return completions.slice(startIndex).map(c => ({
      role: c.message.role,
      content: c.message.content
    } as Message));
  };

  const makeApiRequest = async (question: string) => {
    // set is loading so we disable some interactive functionality while we load the response
    setIsLoading(true);

    const userCompletion: Completion = {
      message: {
        role: 'user',
        content: question
      },
    };

    const responsePlaceholder: Completion = {
      message: {
        role: 'assistant',
        content: '',
      },
    };

    const messages = convertCompletionsToMessages([...completions, userCompletion]);
    // prepare request bundle
    const request: MessageRequest = {
      messages: messages,
      max: maxMessagesSent,
      top: 5
    };

    //update current chat window with the message sent..
    setCompletions(prevCompletions => [...prevCompletions, userCompletion, responsePlaceholder]);

    try{
      const completionResponse = await completionMySSC({request: request, updateLastMessage: updateLastMessage, chatWith: chatWith});

      setCompletions((prevCompletions) => {
        const updatedCompletions = [...prevCompletions];//making a copy
  
        updatedCompletions[updatedCompletions.length-1] = {
          ...updatedCompletions[updatedCompletions.length-1],
          message: {
            ...updatedCompletions[updatedCompletions.length-1].message,
            context: completionResponse.message.context
          },
        }
        return updatedCompletions;
      })

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
  };

  const handleCloseSnackbar = (_event?: React.SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    setErrorSnackbar(false);
  };

  const handleChatWithChange = (_event: ChangeEvent<HTMLInputElement>, value: string) => {
    setChatWith(value as ChatWith);
  };

  useEffect(() => {
      // Set the `lang` attribute whenever the language changes
      document.documentElement.lang = i18n.language;
  }, [i18n.language]);

  useEffect(() => chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" }), [completions[completions.length-1].message.content]);
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
                {completion.message?.role === "assistant" && completion.message?.content && (
                  <AssistantBubble 
                    text={completion.message.content} 
                    isLoading={index == completions.length-1 && isLoading} 
                    context={completion.message?.context}
                    scrollRef={chatMessageStreamEnd} />
                )}
                {completion.message?.role === "user" && (
                  <UserBubble text={completion.message?.content} />
                )}
              </Fragment>
            ))}
          </Box>
          <div ref={chatMessageStreamEnd} />
          <Box sx={{ position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 1100, bgcolor: 'background.default', padding: '1rem' }}>
            <Grid container item xs={12} alignItems='center' justifyContent='center'>
              <FormLabel id="gpt-mode">
                <Typography variant='body1' sx={{ pr: '10px'}}>{t('chat.with.gpt')}</Typography>
              </FormLabel>
              <FormControl>
                  <RadioGroup
                    row
                    aria-labelledby="gpt-mode"
                    value={chatWith}
                    onChange={handleChatWithChange}
                    name="gpt-mode-radio-btn"
                  >
                    <FormControlLabel value="data" control={<Radio />} label={t('chat.with.gpt.data')} />
                    <FormControlLabel value="tools" control={<Radio />} label={t('chat.with.gpt.tools')} />
                  </RadioGroup>
              </FormControl>
            </Grid>
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
        <Disclaimer />
      </ThemeProvider>
    </>
  )
};
