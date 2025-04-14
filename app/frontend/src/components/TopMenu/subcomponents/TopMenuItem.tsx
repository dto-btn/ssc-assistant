import { Box, Typography } from "@mui/material"
import { FC } from "react";
import { TopMenuItemDefinition } from "./TopMenuItem.types";

type Props = {
    item: TopMenuItemDefinition
}

export const TopMenuItem: FC<Props> = ({ item }) => {
    return (
        <Box
            tabindex={0}
            sx={{
                transition: "border-color 0.2s",
                display: "flex",
                gap: 0.5,
                alignItems: "center",
                cursor: "pointer",
                border: "2px solid transparent",
                padding: "0.25rem 0.5rem",
                borderRadius: "0.5rem",
                ":hover": {
                    borderColor: "white",
                },
                ...(item.extraStyles || [])
            }}
            onClick={item.onClick}
        >
            {item.icon}
            <Typography
                variant="body1"
                sx={{ display: { xs: "none", lg: "block" } }}
                aria-label={item.label}
            >
                {item.label}
            </Typography>
        </Box>
    )
}