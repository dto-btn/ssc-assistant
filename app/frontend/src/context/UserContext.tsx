import React from 'react';

// Create a UserContext with default values
export const UserContext = React.createContext({
  accessToken: '',
  graphData: null
});
