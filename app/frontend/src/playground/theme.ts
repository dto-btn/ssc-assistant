import { createTheme, type PaletteMode } from "@mui/material";

const LIGHT_BACKGROUND_COLOR = "#f5f5f5";
const DEFAULT_SHADOWS = createTheme().shadows;

const getShadows = (mode: PaletteMode) => {
  if (mode !== "dark") {
    return DEFAULT_SHADOWS;
  }

  return DEFAULT_SHADOWS.map((shadow, index) =>
    index === 0 ? shadow : "0px 2px 8px rgba(0,0,0,0.45)"
  ) as typeof DEFAULT_SHADOWS;
};

export const createAppTheme = (mode: PaletteMode) =>
  createTheme({
    palette: {
      mode,
      primary: {
        main: "#4b3e99" /* SSC's official colour code I found using our chatbot! XD */,
        light: "#5848B1",
        dark: "#3d305a",
      },
      secondary: {
        main: "#f33aea",
      },
      background:
        mode === "dark"
          ? {
              default: "#11131a",
              paper: "#1a1e29",
            }
          : {
              default: LIGHT_BACKGROUND_COLOR,
              paper: LIGHT_BACKGROUND_COLOR,
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
    },
    shadows: getShadows(mode),
    components: {
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: "none",
            "&:focus-visible": {
              outline: "2px solid",
              outlineOffset: "2px",
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            "&:focus-visible": {
              outline: "2px solid",
              outlineOffset: "2px",
            },
          },
        },
      },
    },
  });

export const theme = createAppTheme("light");
