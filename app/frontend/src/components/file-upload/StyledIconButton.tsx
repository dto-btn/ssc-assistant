import { styled } from "@mui/material/styles";
import IconButton from "@mui/material/Button";

export const StyledIconButton = styled(IconButton)({
    borderRadius: "50%", // Makes the button round
    minWidth: 0, // Prevent default min width
    padding: "12px",
    "&:hover": {
        backgroundColor: "rgba(0, 0, 0, 0.2)", // Optional hover effect
    },
});
