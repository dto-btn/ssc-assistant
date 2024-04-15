import { Box, Container, TextField, InputAdornment, IconButton, CircularProgress } from '@mui/material';
import Send from '@mui/icons-material/Send';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

interface ChatInputProps {
  onSend: (question: string) => void;
  disabled: boolean;
  placeholder?: string;
  clearOnSend?: boolean;
};

export const ChatInput = ({onSend, disabled, clearOnSend}: ChatInputProps) => {
  const [question, setQuestion] = useState<string>("");
  const { t } = useTranslation();
  const [error, setError] = useState(false);

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

  return (
    <Container
        component="footer"
        sx={{ mb: 1, position: 'sticky', bottom: 0}}
        maxWidth="md"
        >
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
          onKeyDown={onEnterPress}
          id="ask-question"
          label={t("ask.question")}
          type="text"
          fullWidth={true}
          multiline={true}
          minRows={3}
          maxRows={3}
          variant='outlined'
          InputProps={{
            endAdornment: <InputAdornment position="end">
                            <IconButton onClick={sendQuestion} disabled={disabled}>
                            {disabled ? (
                              <CircularProgress size={24} aria-label={t("generating")}/>
                            ) : (
                              <Send sx={{ color: 'primary.main' }} aria-label={t("send")}/>
                            )}
                            </IconButton>
                          </InputAdornment>,
            //inputProps: {'maxLength': 24000}
          }}
          />
      </Box>
    </Container>
  );
};