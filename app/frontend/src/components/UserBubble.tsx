import { Box, Paper, Typography } from '@mui/material';

interface UserChatProps {
    text: string | null | undefined;
  }

export const UserBubble = ({ text }: UserChatProps) => {
  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: '2rem' }}>
      <Paper
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          py: 2,
          px: 2,
          borderRadius: '20px',
          borderTopRightRadius: 0,
          maxWidth: '80%',
        }}
      >
        <Typography variant="body1">{text}</Typography>
      </Paper>
    </Box>
  );
};