import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { useMsal } from "@azure/msal-react";
import { apiUse } from "../../authConfig";
import { setAccessToken as setAccessTokenAction } from "../store/slices/authSlice";

/**
 * Acquire a bearer token on mount and seed the playground store so API calls
 * have credentials without each component fetching independently.
 */
const TokenProvider = () => {
  const { instance, accounts } = useMsal();
  const dispatch = useDispatch();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await instance.acquireTokenSilent({ scopes: apiUse.scopes as string[], account: accounts[0] });
        if (mounted) {
          dispatch(
            setAccessTokenAction({
              token: res.accessToken,
              expiresOn: res.expiresOn ? res.expiresOn.getTime() : undefined,
            })
          );
        }
      } catch {
        // silent failure; components will retry as needed
      }
    })();
    return () => { mounted = false; };
  }, [instance, accounts, dispatch]);

  return null;
};

export default TokenProvider;
