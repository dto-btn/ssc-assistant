import React from 'react';

export type GraphData = { [key: string]: unknown } | null;

export const UserContext = React.createContext<{ graphData: GraphData; profilePictureURL: string }>({
  graphData: null,
  profilePictureURL: ""
});