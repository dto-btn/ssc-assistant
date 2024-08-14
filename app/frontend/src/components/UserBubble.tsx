import { Box, Paper, Typography, styled } from '@mui/material';
import { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { UserProfilePicture } from './ProfilePicture';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'
import { visuallyHidden } from '@mui/utils';
import { t } from 'i18next';

interface UserChatProps {
  text: string | null | undefined;
  quote?: string;
}

export const UserBubble = ({ text, quote }: UserChatProps) => {
  const { graphData } = useContext(UserContext);

  return (
    <Box sx={{ display: 'flex', justifyContent: 'flex-end', my: '2rem' }}>
      <Paper
        sx={{
          bgcolor: 'primary.main',
          color: 'primary.contrastText',
          borderRadius: '20px',
          borderTopRightRadius: 0,
          maxWidth: '70%',
          padding: '10px', /* Add padding to avoid text touching edges */
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
              maxWidth: 'calc(100% - 10px)',
              pl: '10px', 
              fontSize: '14px',
              color: 'black',
              flex: 1
            }}
          >
            "{quote}"
          </Typography>
        </QuoteContainer>
        )}
        <UserBubbleContainer tabIndex={0}>
          <Typography sx={visuallyHidden}>{t("aria.user.question")}</Typography> {/* Hidden div for screen reader */}
          <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </UserBubbleContainer>
      </Paper>
      <ProfilePictureView>
        {graphData && 
          <UserProfilePicture size='40px'  fullName={graphData['givenName'] + " " + graphData['surname']} />
        }
      </ProfilePictureView>
    </Box>
  );
};

const UserBubbleContainer = styled(Box)`
  display: flex;
  flex-direction: column;
  padding: 0px 15px;
  max-width: 100%;
`

const ProfilePictureView = styled(Box)`
  margin: 5px 0px 0px 10px;
`

const QuoteContainer = styled(Box)`
  display: flex;
  align-items: center;
  height: 60px;
  margin: 10px 10px 0px 10px;
  background-color: white;
  border-radius: 10px;
`