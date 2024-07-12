import { graphConfig } from "./authConfig";

/**
 * Examples:
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/samples/msal-react-samples/typescript-sample/src/utils/MsGraphApiCall.ts
 * https://github.com/Azure-Samples/ms-identity-docs-code-javascript/blob/main/react-spa/src/graph.js
 */
export async function callMsGraph(accessToken: string) {
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
            console.error('Could not fetch profile picture');
        }
    } catch (error) {
        console.error('Error fetching profile picture:', error);
    }

    return {graphData, accessToken, profilePictureURL};
}
