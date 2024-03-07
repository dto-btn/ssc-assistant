import { useState, useEffect } from 'react';

interface UserProfileProps {
    accessToken: string | null | undefined;
  }

export const UserProfilePicture = ({ accessToken } : UserProfileProps) => {
  const [profilePic, setProfilePic] = useState<string>("");

  useEffect(() => {
    const fetchProfilePic = async () => {
      console.log("access token is invoked " + accessToken);
      try {
        const response = await fetch(`https://graph.microsoft.com/v1.0/me/photo/$value`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (response.ok) {
          const imageBlob = await response.blob();
          console.log("blob" + imageBlob);
          const imageUrl = URL.createObjectURL(imageBlob);
          setProfilePic(imageUrl);
        } else {
          // Handle errors or the case where there is no profile photo
          console.error('Could not fetch profile picture');
        }
      } catch (error) {
        console.error('Error fetching profile picture:', error);
      }
    };

    if (accessToken) {
      fetchProfilePic();
    }
  }, [accessToken]);

  if (!profilePic) {
    return <div>No profile picture available</div>;
  }

  return <img src={profilePic} alt="User Profile" />;
};