import { useEffect, useState } from "react";
import MainScreen from "../screens/MainScreen";
import { callMsGraph } from "../graph";
import { GraphData, UserContext } from "../stores/UserContext";

export const RootRoute = () => {
    const [userData, setUserData] = useState<{ graphData: GraphData; profilePictureURL: string }>({ graphData: null, profilePictureURL: "" });

  // Prefetch basic user data once auth templates are ready; this avoids a follow-up render inside MainScreen
  useEffect(() => {
    let mounted = true;
    callMsGraph().then((response) => {
      if (!mounted) return;
      setUserData({ graphData: response.graphData, profilePictureURL: response.profilePictureURL });
    }).catch(() => {/* ignore */});
    return () => { mounted = false; };
  }, []);
    return (
        <UserContext.Provider value={userData}>
            <MainScreen />
        </UserContext.Provider>
        
    )
}