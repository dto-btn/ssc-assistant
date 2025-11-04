import Avatar from '@mui/material/Avatar';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';

interface UserProfileProps {
  size?: string;
  fontSize?: string;
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
  const threshold = 128; // Midpoint value for high contrast

  for (i = 0; i < 3; i += 1) {
    let value = (hash >> (i * 8)) & 0xff;
    // Adjust value to ensure high contrast
    value = value > threshold ? 0 : 128;
    color += `00${value.toString(16)}`.slice(-2);
  }
  /* eslint-enable no-bitwise */

  return color;
}

function getLetterAvatar(name: string, size: string | undefined, fontSize: string | undefined): AvatarData {
  const avatarData: AvatarData = {
    sx: {
      bgcolor: stringToColor(name),
    },
    children: `${name.split(' ')[0][0]}${name.split(' ')[1][0]}`,
  };

  if (fontSize) {
    avatarData.sx.fontSize = fontSize;
  }

  if (size) {
    avatarData.sx.width = size;
    avatarData.sx.height = size;
  }

  return avatarData;
}

export const UserProfilePicture = ({ size, fontSize }: UserProfileProps) => {
  const profilePictureURL = useSelector((state:RootState) => state.user.profilePictureURL);
  const graphData = useSelector((state:RootState) => state.user.graphData);

  let fullName: string = ". .";
  if (graphData) {
    fullName = graphData["givenName"] + " " + graphData["surname"];
  }


  if (profilePictureURL) {
    return <Avatar aria-hidden alt={fullName} src={profilePictureURL} sx={size ? { width: size, height: size } : {}}
    />
  } else {
    const letterAvatar = getLetterAvatar(fullName, size, fontSize);
    return <Avatar aria-hidden alt={fullName} sx={letterAvatar?.sx} children={letterAvatar?.children} />;
  }
};