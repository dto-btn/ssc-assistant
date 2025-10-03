/**
 * Citations component
 *
 * Displays a list of source citations referenced by a chat response. This
 * component transforms citation metadata into clickable links and adds any
 * necessary UI affordances for copying or opening sources.
 */

import React from "react";
import { Box, Typography, Link } from "@mui/material";
import { useTranslation } from 'react-i18next';

export interface Citation {
  title: string;
  url: string;
}

interface Props {
  citations: Citation[];
}

const Citations: React.FC<Props> = ({ citations }) => {
  const { t } = useTranslation('playground');

  if (!citations || citations.length === 0) return null;

  return (
    <Box bgcolor="grey.50" p={2} mt={2} borderRadius={2}>
      <Typography variant="subtitle2" gutterBottom>
        Citations
      </Typography>
      {citations.map((citation, i) => (
        <Box key={i} mb={1}>
          <Typography variant="body2">
            {citation.title}{" "}
            <Link href={citation.url} target="_blank" rel="noopener noreferrer">
              [{t("link")}]
            </Link>
          </Typography>
        </Box>
      ))}
    </Box>
  );
};

export default Citations;