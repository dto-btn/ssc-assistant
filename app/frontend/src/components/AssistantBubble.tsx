import { Box, Paper, Typography } from '@mui/material';

interface AssistantBubbleProps {
    text: string;
  }

export const AssistantBubble = ({ text }: AssistantBubbleProps) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-start', my: '2rem' }}>
      <Paper
        sx={{
          bgcolor: 'white',
          color: 'white.contrastText',
          py: 1,
          px: 2,
          borderRadius: '20px',
          borderTopLeftRadius: 0,
          maxWidth: '80%',
        }}
      >
        <Typography variant="body1">{text}</Typography>
      </Paper>
    </Box>
  );
};