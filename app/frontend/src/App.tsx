import { ThemeProvider, createTheme } from "@mui/material/styles";
import { useEffect, useState } from "react";
//https://github.com/AzureAD/microsoft-authentication-library-for-js/tree/dev/samples/msal-react-samples/typescript-sample
import { loginRequest } from "./authConfig";
import { callMsGraph } from './graph';
import { UserContext } from './context/UserContext';
import { AccountInfo, InteractionRequiredAuthError, InteractionStatus } from "@azure/msal-browser";
import {
  useIsAuthenticated,
  useMsal,
  AuthenticatedTemplate,
  UnauthenticatedTemplate
} from "@azure/msal-react";
import ConnectingScreen from "./screens/ConnectingScreen";
import MainScreen from "./screens/MainScreen";

const mainTheme = createTheme({
  palette: {
    primary: {
      main: "#4b3e99" /* SSC's official colour code I found using our chatbot! XD */,
    },
    secondary: {
      main: "#f33aea",
    },
    background: {
      default: "white",
    },
  },
});

export const App = () => {
  const {instance, inProgress} = useMsal();
  const [userData, setUserData] = useState({
    accessToken: '',
    graphData: null,
    profilePictureURL: ''
  });
  const isAuthenticated = useIsAuthenticated();

  useEffect(() => {
    console.debug(inProgress);
    if (isAuthenticated && !userData.graphData && inProgress === InteractionStatus.None) {
      console.debug("Acquire silent token.");
      instance.acquireTokenSilent({
          ...loginRequest,
          account: instance.getActiveAccount() as AccountInfo
      }).then(response => {
        setUserData({accessToken: response.accessToken, graphData: null, profilePictureURL: ''});      
      }).catch((e) => {
        if (e instanceof InteractionRequiredAuthError) {
          console.warn("Unable to get token via silent method, will use redirect instead.");
          instance.acquireTokenRedirect({
            ...loginRequest,
            account: instance.getActiveAccount() as AccountInfo
          })
        }
      });
    }
  }, [inProgress, userData.graphData, isAuthenticated]);

  // Effect for calling Microsoft Graph after acquiring a token
  useEffect(() => {
    if (userData.accessToken && !userData.graphData) {
      callMsGraph(userData.accessToken).then(response => {
        setUserData({ 
          accessToken: userData.accessToken, 
          graphData: response.graphData,
          profilePictureURL: response.profilePictureURL
        });
      });
    }
  }, [userData.accessToken]);

  return (
    <UserContext.Provider value={userData}>
      <UnauthenticatedTemplate>
        <ConnectingScreen />
      </UnauthenticatedTemplate>
      <AuthenticatedTemplate>
        <ThemeProvider theme={mainTheme}>
          <MainScreen userData={userData} />
        </ThemeProvider>
      </AuthenticatedTemplate>
    </UserContext.Provider>
  );
};
