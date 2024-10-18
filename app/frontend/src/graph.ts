import { loginRequest, graphConfig } from "./authConfig";
import { msalInstance } from "./index";

/**
 * Examples:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/samples/msal-react-samples/typescript-sample/src/utils/MsGraphApiCall.ts
 * https://github.com/Azure-Samples/ms-identity-docs-code-javascript/blob/main/react-spa/src/graph.js
 */
export async function callMsGraph(accessToken?: string) {
    // if no access token provided, we simply acquire it silently via 
    // the loginRequest ([User.Read] scope) and with the current authenticated account
    if (!accessToken) {
        const account = msalInstance.getActiveAccount();
        if (!account) {
            throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
        }

        const response = await msalInstance.acquireTokenSilent({
            ...loginRequest,
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

    let profilePictureURL = "";
    try {
        const profilePictureResponse = await fetch(`https://graph.microsoft.com/v1.0/me/photos/48x48/$value`, {
            method: 'GET',
            headers: {
            'Authorization': `Bearer ${accessToken}`,
            },
        });

        if (profilePictureResponse.ok) {
            const imageBlob = await profilePictureResponse.blob();
            profilePictureURL = URL.createObjectURL(imageBlob);
        } else {
            console.warn("Could not fetch profile picture. It's possible the user has none set to their profile.");
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);
    }

    return {graphData, profilePictureURL};
}
