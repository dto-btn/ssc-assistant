import { Box, Paper, Container, Typography, styled } from '@mui/material';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface UserChatProps {
  text: string | null | undefined;
  quote?: string;
}

export const UserBubble = ({ text, quote }: UserChatProps) => {

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
        elevation={4}
      >
        {quote && (
          <QuoteContainer>
            <Typography 
              variant="body1"
              sx={{ 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                maxWidth: 'calc(100% - 24px)',
                pl: '10px', 
                fontSize: '14px',
                color: 'black',
                flex: 1
              }}
            >
              "{quote}""
            </Typography>
          </QuoteContainer>
        )}
        <Container>
            <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </Container>
      </Paper>
    </Box>
  );
};

const QuoteContainer = styled(Box)`
  display: flex;
  align-items: center;
  height: 60px;
  margin: 10px 10px 0px 10px;
  background-color: white;
  border-radius: 10px;
`