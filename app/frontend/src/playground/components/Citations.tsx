import React from "react";
import { Box, Typography, Link } from "@mui/material";

export interface Citation {
  title: string;
  url: string;
}

interface Props {
  citations: Citation[];
}

const Citations: React.FC<Props> = ({ citations }) => {
  if (!citations || citations.length === 0) return null;

  return (
    <Box bgcolor="grey.50" p={2} mt={2} borderRadius={2}>
      <Typography variant="subtitle2" gutterBottom>
        Citations
      </Typography>
      {citations.map((c, i) => (
        <Box key={i} mb={1}>
          <Typography variant="body2">
            {c.title}{" "}
            <Link href={c.url} target="_blank" rel="noopener noreferrer">
              [link]
            </Link>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default Citations;