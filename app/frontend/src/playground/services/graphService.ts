import { IPublicClientApplication } from "@azure/msal-browser";

const userRead = {
  scopes: ["User.Read"]
}

const graphConfig = {
  graphMeEndpoint: "https://graph.microsoft.com/v1.0/me"
}

/**
 * Microsoft Graph Service
 * 
 * Handle requests aimed at Microsoft Graph.  
 * 
 * Examples:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/samples/msal-react-samples/typescript-sample/src/utils/MsGraphApiCall.ts
 * https://github.com/Azure-Samples/ms-identity-docs-code-javascript/blob/main/react-spa/src/graph.js
 */
export async function fetchProfilePicture(msalInstance: IPublicClientApplication, accessToken?: string) {
  // if no access token provided, we simply acquire it silently via 
  // the loginRequest ([User.Read] scope) and with the current authenticated account
  if (!accessToken) {
    const account = msalInstance.getActiveAccount();
    if (!account) {
      throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
    }

    const response = await msalInstance.acquireTokenSilent({
      ...userRead,
      account: account
    });
    accessToken = response.accessToken;
  }

  const headers = new Headers();
  const bearer = `Bearer ${accessToken}`;
  headers.append("Authorization", bearer);

  const options = {
    method: "GET",
    headers: headers
  };

  const graphResponse = await fetch(graphConfig.graphMeEndpoint, options);
  const graphData = await graphResponse.json();

  let profilePictureURL = ""
  try {
    const profilePictureResponse = await fetch(`https://graph.microsoft.com/v1.0/me/photos/48x48/$value`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!profilePictureResponse.ok) {
      console.warn("Could not fetch profile picture. It's possible the user has none set to their profile.");
    }

    const imageBlob = await profilePictureResponse.blob();
    profilePictureURL = await streamToBlobAndRead(imageBlob);

  } catch (error) {
    console.error('Error fetching profile picture:', error);
  }
  return { graphData, profilePictureURL };
}

/**
 * Takes blob to read and save into a dataUrl
 * 
 * @param imageBlob image blob
 * @returns Base64 encoded string of image blob.  Looks like "data:image/jpeg;base64,/9j/4AAQSkZJRgA...."
 */
async function streamToBlobAndRead(imageBlob: Blob): Promise<string> {
 
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error("FileReader did not return a string result"))
      }
    }
    reader.onerror = (error) => {
      reject(error);
    }
    reader.readAsDataURL(imageBlob);
  })
}

