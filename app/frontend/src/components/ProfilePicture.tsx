import { useState, useEffect } from 'react';
import Avatar from '@mui/material/Avatar';

interface UserProfileProps {
  accessToken: string | null | undefined;
  fullName: string;
  size?: string;
}

interface AvatarData {
  sx: {
    bgcolor: string;
    width?: string;
    height?: string;
  };
  children: string;
}

function stringToColor(string: string) {
  let hash = 0;
  let i;

  /* eslint-disable no-bitwise */
  for (i = 0; i < string.length; i += 1) {
    hash = string.charCodeAt(i) + ((hash << 5) - hash);
  }

  let color = '#';

  for (i = 0; i < 3; i += 1) {
    const value = (hash >> (i * 8)) & 0xff;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
}

function getLetterAvatar(name: string, size: string = '40px'): AvatarData {
  return {
    sx: {
      bgcolor: stringToColor(name),
      width: size,
      height: size
    },
    children: `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`,
  };
}

export const UserProfilePicture = ({ accessToken, fullName, size } : UserProfileProps) => {
  const [profilePic, setProfilePic] = useState<string>("");
  const [letterAvatar, setLetterAvatar] = useState<AvatarData>();

  useEffect(() => {
    const fetchProfilePic = async () => {
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/photos/48x48/$value`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const imageBlob = await response.blob();
          const imageUrl = URL.createObjectURL(imageBlob);
          setProfilePic(imageUrl);
        } else {
          // Handle errors or the case where there is no profile photo
          console.error('Could not fetch profile picture');
          setLetterAvatar(getLetterAvatar(fullName, size));
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      }
    };

    if (accessToken) {
      fetchProfilePic();
    }
  }, [accessToken]);

  if(profilePic)
    return <Avatar alt={fullName} src={profilePic} 
  />;
  else if (letterAvatar)
    return <Avatar alt={fullName} sx={letterAvatar.sx} children={letterAvatar.children} />;
  else
    return null;
};