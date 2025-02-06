import { createTheme } from "@mui/material";

const BACKGROUND_COLOR = "#f5f5f5";

export const theme = createTheme({
    palette: {
      primary: {
        main: "#4b3e99" /* SSC's official colour code I found using our chatbot! XD */,
      },
      secondary: {
        main: "#f33aea",
      },
      background: {
        default: BACKGROUND_COLOR,
        paper: "BACKGROUND_COLOR",
      },
    },
  });