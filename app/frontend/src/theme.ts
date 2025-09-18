import { createTheme } from "@mui/material";

const BACKGROUND_COLOR = "#f5f5f5";

export const theme = createTheme({
    palette: {
      primary: {
        main: "#4b3e99" /* SSC's official colour code I found using our chatbot! XD */,
        light: "#5848B1",
      },
      secondary: {
        main: "#f33aea",
      },
      background: {
        default: BACKGROUND_COLOR,
        paper: BACKGROUND_COLOR,
      },
    },
  typography: {
    fontFamily: "Roboto, sans-serif",
    h1: {
      fontSize: "3rem",
      fontWeight: 700,
    },
    h2: {
      fontSize: "2.5rem",
      fontWeight: 700,
    },
    h3: {
      fontSize: "2rem",
      fontWeight: 700,
    },
    h4: {
      fontSize: "1.5rem",
      fontWeight: 700,
    },
    h5: {
      fontSize: "1.25rem",
      fontWeight: 700,
    },
    h6: {
      fontSize: "1rem",
      fontWeight: 700,
    },
  }
  });