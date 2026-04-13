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
        backgroundColor: "#d32f2f",
        color: "white",
        padding: "4px 10px",
        fontSize: "12px",
        fontWeight: "bold",
        borderRadius: "4px",
        textTransform: "uppercase",
        boxShadow: "0 1px 2px rgba(0,0,0,0.2)",
        height: "fit-content",
        userSelect: "none",
      }}
      aria-label="Development environment indicator"
    >
      DEV
    </Box>
  );
};