import { Box, Paper, LinearProgress, Container } from '@mui/material';
import { useTheme } from '@mui/material/styles';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface AssistantBubbleProps {
    text: string | null | undefined;
    isLoading: boolean;
  }

export const AssistantBubble = ({ text, isLoading }: AssistantBubbleProps) => {

  const theme = useTheme();

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
          <Container>
            <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{isLoading ? text.replace(/\[doc(\d{1,2})\]/g, '') : text}</Markdown>
            {/* <Typography variant="body1">{text}</Typography> */}
            {isLoading && (
              <>
                <LinearProgress color="inherit" sx={{ width: '70%', mt: 1, height: theme.typography.fontSize}}/>
                <LinearProgress color="inherit" sx={{ width: '90%', my: 1, height: theme.typography.fontSize}}/>
              </>
            )}
          </Container>
          ) : (
            <Container sx={{ minWidth: theme.breakpoints.values.sm, width: '100%' }}>
              <LinearProgress color="inherit" sx={{ width: '100%', mt: 1, height: theme.typography.fontSize}}/>
              <LinearProgress color="inherit" sx={{ width: '70%', mt: 1, height: theme.typography.fontSize}}/>
              <LinearProgress color="inherit" sx={{ width: '90%', my: 1, height: theme.typography.fontSize}}/>
            </Container>
          )
        }
      </Paper>
    </Box>
  );
};