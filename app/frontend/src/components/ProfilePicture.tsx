import { useState, useEffect } from 'react';
import Avatar from '@mui/material/Avatar';
import { useContext } from 'react';
import { UserContext } from '../context/UserContext';

interface UserProfileProps {
  fullName: string;
  size?: string;
}

interface AvatarData {
  sx: {
    bgcolor: string;
    width?: string;
    height?: string;
    fontSize?: string;
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

function getLetterAvatar(name: string, size: string | undefined): AvatarData {
  return {
    sx: {
      bgcolor: stringToColor(name),
      ...(size && { width: size, height: size, fontSize: '16px' })
    },
    children: `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`,
  };
}

export const UserProfilePicture = ({ fullName, size } : UserProfileProps) => {
  const { profilePictureURL } = useContext(UserContext);
  const [letterAvatar, setLetterAvatar] = useState<AvatarData>();

  useEffect(() => {
    if (!profilePictureURL) {
      setLetterAvatar(getLetterAvatar(fullName, size));
    }
  }, [profilePictureURL, fullName, size]);

  if(profilePictureURL)
    return <Avatar alt={fullName} src={profilePictureURL}  sx={size ? { width: size, height: size } : {}}  
  />;
  else if (letterAvatar)
    return <Avatar alt={fullName} sx={letterAvatar.sx} children={letterAvatar.children} />;
  else
    return null;
};