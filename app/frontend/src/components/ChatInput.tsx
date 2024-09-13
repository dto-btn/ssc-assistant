import { Box, Container, TextField, InputAdornment, IconButton, CircularProgress, styled, Typography, useTheme } from '@mui/material';
import Send from '@mui/icons-material/Send';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import KeyboardReturnIcon from '@mui/icons-material/KeyboardReturn'
import CloseIcon from '@mui/icons-material/Close';

interface ChatInputProps {
  onSend: (question: string) => void;
  disabled: boolean;
  placeholder?: string;
  clearOnSend?: boolean;
  quotedText?: string;
  handleRemoveQuote: () => void;
  selectedModel: string;
};

export const ChatInput = ({onSend, disabled, clearOnSend, quotedText, handleRemoveQuote, selectedModel}: ChatInputProps) => {
  const [question, setQuestion] = useState<string>("");
  const { t } = useTranslation();
  const [error, setError] = useState(false);
  const theme = useTheme();
  
  const modelName = selectedModel === "gpt-4o" ? "GPT-4o" : "GPT-3.5 Turbo"

  const sendQuestion = () => {
      if (disabled || !question.trim()) {
          return;
      }

      onSend(question);

      if (clearOnSend) {
          setQuestion("");
      }
  };

  const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
    if (ev.key === "Enter" && !ev.shiftKey) {
        ev.preventDefault();
        sendQuestion();
    }
  };

  // this useEffect focuses the chatInput whenever quotedText is added
  useEffect(() => {
    if (quotedText) {
      const chatInput = document.getElementById("ask-question")
      chatInput?.focus()
    }
  }, [quotedText]); 

  return (
    <Container
        component="footer"
        sx={{ mb: 1, position: 'sticky', bottom: 0}}
        maxWidth="md"
        >
      <Typography sx={{fontSize: '13px', ml: '10px', opacity: 0.7}}>{t("model.version.disclaimer")} {modelName}</Typography>
      <ChatInputWrapper theme={theme}> 
        {quotedText && (
            <QuoteContainer>
              <KeyboardReturnIcon sx={{ transform: 'scaleX(-1)', ml: '8px', color: 'black' }} />
              <Typography 
                variant="body1"
                sx={{ 
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  maxWidth: 'calc(100% - 24px)',
                  fontSize: '14px',
                  ml: '10px', 
                  mr: '5px',
                  color: 'black',
                  flex: 1
                }}
              >
                "{quotedText}"
              </Typography>
              <IconButton 
                  onClick={handleRemoveQuote}
                  sx={{ 
                    mr: '5px',
                    '&:hover': {
                      backgroundColor: '#979797'
                    }
                  }}
              >
                <CloseIcon 
                  sx={{
                    fontSize: '20px',
                    color: 'black' 
                  }}
                />
              </IconButton>
            </QuoteContainer>
        )}
        <Box
          component="form"
          noValidate
          autoComplete="off"
        >
          <TextField
            error={error}
            helperText={error ? t("question.maxlength") : ""}
            value={question}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              if(event.target.value && event.target.value.length > 24000)
                setError(true)
              else
                setError(false)
              setQuestion(event.target.value);
            }}
            fullWidth
            type="text"
            id="ask-question"
            placeholder={t("ask.question")}
            onKeyDown={onEnterPress}
            multiline={true}
            minRows={3}
            maxRows={3}
            label={t("ask.question")}
            sx={{
              padding: '10px 20px',
              '& .MuiInputBase-input::placeholder': {
                opacity: 0.7, 
              },
            }}
            variant="standard"
            InputProps={{
              disableUnderline: true,
              endAdornment: <InputAdornment position="end">
                              <IconButton
                                onClick={sendQuestion} 
                                disabled={disabled}
                                sx={{ '&:hover': {
                                  backgroundColor: 'rgba(0, 0, 0, 0.2)'
                                } }}
                                aria-label={t("send")}
                              >                              {disabled ? (
                                <CircularProgress size={24} aria-label={t("generating")}/>
                              ) : (
                                <Send sx={{ color: 'primary.main' }} aria-label={t("send")}/>
                              )}
                              </IconButton>
                            </InputAdornment>,
            }}
          >  
          </TextField>
        </Box>
      </ChatInputWrapper>
    </Container>
  );
};


const ChatInputWrapper = styled(Box)(({ theme }) => ({
  border: '2px solid #e0e0e0',
  borderRadius: '5px',
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
  }
}));

const QuoteContainer = styled(Box)`
  display: flex;
  align-items: center;
  height: 60px;
  width: 95%;
  margin: 10px 0px 0px 20px;
  background-color: lightgrey;
  border-radius: 10px;
`