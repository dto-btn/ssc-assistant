import React from "react";
import { Box, Typography } from "@mui/material";
import { useSelector } from "react-redux";
import type { RootState } from "../store";
import { selectMessagesBySessionId } from "../store/selectors/chatSelectors";
import {
  CATEGORY_GENERIC,
  getCategoryDescription,
  resolveMcpServersForCategory,
} from "../services/categoryService";

export const DevBanner = () => {
  const showBanner = import.meta.env.VITE_SHOW_DEV_BANNER === "true";

  const messages = useSelector(selectMessagesBySessionId);
  const mcpServers = useSelector((state: RootState) => state.tools.mcpServers);

  const lastUserMessage = React.useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index].role === "user") {
        return messages[index];
      }
    }
    return undefined;
  }, [messages]);

  const category = lastUserMessage?.category || CATEGORY_GENERIC;
  const model = lastUserMessage?.model || "unknown";
  const categoryDescription = getCategoryDescription(category);
  const routedServers = resolveMcpServersForCategory(category, mcpServers);
  const serverLabel = routedServers.length
    ? routedServers.map((server) => server.server_label).join(", ")
    : "none";

  if (!showBanner) return null;

  return (
    <Box
      sx={{
        display: "inline-flex",
        flexDirection: "column",
        alignItems: "flex-start",
        gap: 0.25,
        marginLeft: "12px",
        backgroundColor: "#ff6b6b",
        color: "white",
        padding: "6px 10px",
        fontSize: "12px",
        fontWeight: "bold",
        borderRadius: "4px",
        textTransform: "uppercase",
        boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
        minWidth: 120,
        position: "absolute",
        bottom: 10,
        left: 250,
      }}
    >
      <Typography sx={{ fontSize: "12px", fontWeight: 700, lineHeight: 1 }}>
        DEV
      </Typography>
      <Typography sx={{ fontSize: "11px", fontWeight: 500, lineHeight: 1.2 }}>
        cat: {category}
      </Typography>
      <Typography sx={{ fontSize: "10px", fontWeight: 400, lineHeight: 1.2 }}>
        desc: {categoryDescription}
      </Typography>
      <Typography sx={{ fontSize: "11px", fontWeight: 500, lineHeight: 1.2 }}>
        model: {model}
      </Typography>
      <Typography sx={{ fontSize: "11px", fontWeight: 500, lineHeight: 1.2 }}>
        mcp: {serverLabel}
      </Typography>
    </Box>
  );
};