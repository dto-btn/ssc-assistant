import { jwtDecode } from "jwt-decode";

export function checkIfTokenExpired(token: string | undefined): boolean {

  if (token === undefined) {
    console.error('Token is undefined.');
    return true;
  }

  try {
    const decoded = jwtDecode(token);
    if(!decoded) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    const exp = decoded.exp;
    if(exp && exp < currentTime){
      console.info("Token is expired ..");
      return true;
    }
    return false;
  } catch (error) {
    console.error('Error validating token:', error); 
    return true;
  }
}