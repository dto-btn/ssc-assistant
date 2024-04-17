import { loginRequest, graphConfig } from "./authConfig";
import { msalInstance } from "./index";

/**
 * https://github.com/AzureAD/microsoft-authentication-library-for-js/blob/dev/samples/msal-react-samples/typescript-sample/src/utils/MsGraphApiCall.ts
 */
export async function callMsGraph() {
    const account = msalInstance.getActiveAccount();
    if (!account) {
        throw Error("No active account! Verify a user has been signed in and setActiveAccount has been called.");
    }

    const response = await msalInstance.acquireTokenSilent({
        ...loginRequest,
        account: account
    });

    const accessToken = response.accessToken;
    const headers = new Headers();
    const bearer = `Bearer ${accessToken}`;

    headers.append("Authorization", bearer);

    const options = {
        method: "GET",
        headers: headers
    };

    const graphResponse = await fetch(graphConfig.graphMeEndpoint, options);  
    const graphData = await graphResponse.json();  

    return {graphData, accessToken};
}