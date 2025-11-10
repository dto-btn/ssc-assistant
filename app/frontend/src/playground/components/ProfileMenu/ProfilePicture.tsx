import Avatar from '@mui/material/Avatar';
import { useSelector } from 'react-redux';
import { RootState } from '../../store';
import { Typography } from '@mui/material';

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

/**
 * Gets initials for avatar in the event of no picture.
 * 
 * Empty name will return "" for initials, result in just a man for avatar
 * One word (first or last doens't matter), will result in a single initial
 * Two is the typical
 * Anything above two takes first char of first word and last word
 * 
 * @param name full name of user
 * @param size size of avatar
 * @param fontSize size of letters to create avatar.
 * @returns {@link AvatarData} 
 */
function getLetterAvatar(name: string, size: string | undefined, fontSize: string | undefined): AvatarData {
  
  let nameParts = name.trim().split(" ")
  let initials;

  //Split will almost never return array of 0 here.
  if (nameParts.length < 2 ) {
    if (nameParts[0].length === 0) {
      initials = ""
    } else {
      initials = nameParts[0][0]
    }
  } else {
    initials = nameParts[0][0] + nameParts[nameParts.length-1][0];
  }

  const avatarData: AvatarData = {
    sx: {
      bgcolor: stringToColor(name),
    },
    children: initials
  };
  if (fontSize) {
    avatarData.sx.fontSize = fontSize;
  }

  if (size) {
    avatarData.sx.width = size;
    avatarData.sx.height = size;
  }

  return avatarData
}

export const UserProfilePicture = ({ size, fontSize }: UserProfileProps) => {
  
  const userData = useSelector((state: RootState) => ({
    profilePictureURL: state.user.profilePictureURL,
    graphData: state.user.graphData
  }));

  const { profilePictureURL, graphData } = userData;

  let fullName: string = "";
  if (graphData) {
    fullName = graphData["givenName"] + " " + graphData["surname"];
  }


  if (profilePictureURL) {
       return <> 
       <Avatar aria-hidden alt={fullName} src={profilePictureURL} sx={size ? { width: size, height: size } : {}} />
       <Typography sx={{ marginLeft: 3, textTransform: 'none', color: 'black'}}>{fullName}</Typography>
       </>
  } else {
    const letterAvatar = getLetterAvatar(fullName, size, fontSize);
    return <>
      <Avatar aria-hidden alt={fullName} sx={letterAvatar?.sx} children={letterAvatar?.children}/>
      <Typography sx={{ marginLeft: 1, textTransform: 'none', color: 'black'}}>{fullName}</Typography>
    </> 
  }
};