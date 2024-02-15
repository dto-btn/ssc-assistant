import { Box, Paper, Typography, LinearProgress } from '@mui/material';

interface AssistantBubbleProps {
    text: string | null | undefined;
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
        {(text !== null && text !== undefined && text !== '') ?
          (
            <Typography variant="body1">{text}</Typography>
          ) : (
            <Box>
              <LinearProgress sx={{ width: '150px', mt: 1}}/>
              <LinearProgress sx={{ width: '100px', mt: 1}}/>
              <LinearProgress sx={{ width: '150px', mt: 1}}/>
              <LinearProgress sx={{ width: '75px', my: 1}}/>
            </Box>
          )
        }
      </Paper>
    </Box>
  );
};