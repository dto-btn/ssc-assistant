import { loginRequest, graphConfig } from "./authConfig";
import { msalInstance } from "./index";

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

    return {graphData, accessToken};
}