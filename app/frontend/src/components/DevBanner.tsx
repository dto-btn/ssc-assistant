import { Box } from "@mui/material";

export const DevBanner = () => {
  const showBanner = import.meta.env.VITE_SHOW_DEV_BANNER === "true";

  if (!showBanner) return null;

  return (
    <Box
      sx={{
        display: "inline-flex",
        alignItems: "center",
        marginLeft: "12px",
        backgroundColor: "#ff6b6b",
        color: "white",
        padding: "4px 12px",
        fontSize: "12px",
        fontWeight: "bold",
        borderRadius: "4px",
        textTransform: "uppercase",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
      }}
    >
      DEV
    </Box>
  );
};