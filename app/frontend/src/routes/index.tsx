import { useEffect, useState } from "react";
import MainScreen from "../screens/MainScreen";
import { callMsGraph } from "../graph";
import { GraphData, UserContext } from "../stores/UserContext";

export const RootRoute = () => {
    const [userData, setUserData] = useState<{ graphData: GraphData; profilePictureURL: string }>({ graphData: null, profilePictureURL: "" });
    const authProvider = (import.meta.env.VITE_AUTH_PROVIDER as string) || "msal";

  // Prefetch basic user data once auth templates are ready; this avoids a follow-up render inside MainScreen
  useEffect(() => {
    if (authProvider !== "msal") {
      return () => { };
    }
    let mounted = true;
    callMsGraph().then((response) => {
      if (!mounted) return;
      setUserData({ graphData: response.graphData, profilePictureURL: response.profilePictureURL });
    }).catch(() => {/* ignore */});
    return () => { mounted = false; };
  }, [authProvider]);
    return (
        <UserContext.Provider value={userData}>
            <MainScreen />
        </UserContext.Provider>
        
    )
}