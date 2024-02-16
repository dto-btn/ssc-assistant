import { Box, Paper, Container } from '@mui/material';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { useTheme } from '@mui/material/styles';

interface UserChatProps {
    text: string | null | undefined;
  }

export const UserBubble = ({ text }: UserChatProps) => {

  const theme = useTheme();

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: '2rem' }}>
      <Paper
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: '20px',
          borderTopRightRadius: 0,
          maxWidth: '80%',
        }}
      >
        <Container>
            <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </Container>
      </Paper>
    </Box>
  );
};