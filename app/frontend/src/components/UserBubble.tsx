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
}

export const UserBubble = ({ text }: UserChatProps) => {

  const { graphData } = useContext(UserContext);

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
        <UserBubbleContainer tabIndex={0}>
          <Typography sx={visuallyHidden}>{t("aria.user.question")}</Typography>
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
  flex-direction: row;
  padding: 0px 15px;
`

const ProfilePictureView = styled(Box)`
  margin: 5px 0px 0px 10px;
`