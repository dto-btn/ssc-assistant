import { Box, Paper, styled } from '@mui/material';
import { useContext } from 'react';
import { UserContext } from '../context/UserContext';
import { UserProfilePicture } from './ProfilePicture';
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import 'highlight.js/styles/github.css'

interface UserChatProps {
  text: string | null | undefined;
}

export const UserBubble = ({ text }: UserChatProps) => {

  const { accessToken, graphData } = useContext(UserContext);

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
        <UserBubbleContainer>
            <ProfilePictureView>
              {graphData && 
                <UserProfilePicture size='32px' fullName={graphData['givenName'] + " " + graphData['surname']} />
              }
            </ProfilePictureView>
            <Markdown rehypePlugins={[rehypeHighlight]} remarkPlugins={[remarkGfm]}>{text}</Markdown>
        </UserBubbleContainer>
      </Paper>
    </Box>
  );
};

const UserBubbleContainer = styled(Box)`
  display: flex;
  flex-direction: row;
  padding: 0px 15px;
`

const ProfilePictureView = styled(Box)`
  margin: 8px 10px 8px 0px;
`