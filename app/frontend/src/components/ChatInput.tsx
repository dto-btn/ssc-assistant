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
          value={question}
          onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
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
          sx={{
            bgcolor: 'white',
          }}
          InputProps={{
            endAdornment: <InputAdornment position="end">
                            <IconButton onClick={sendQuestion} disabled={disabled}>
                            {disabled ? (
                              <CircularProgress size={24} />
                            ) : (
                              <Send sx={{ color: 'primary.main' }} />
                            )}
                            </IconButton>
                          </InputAdornment>,
          }}
          />
      </Box>
    </Container>
  );
};