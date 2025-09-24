/**
 * Suggestions component
 *
 * Shows suggested prompts or auto-complete options for the user while
 * composing messages in the playground. Suggestions may be derived from
 * session history or model hints and are dispatched back to the store when
 * selected.
 */

import React from "react";
import { Box, Button, Typography } from "@mui/material";

const suggestions = [
  "How can I use the API?",
  "Show me recent GitHub issues",
  "Generate a TypeScript interface",
  "Summarize this document",
];

interface Props {
  onSuggestionClicked: (text: string) => void;
  disabled?: boolean;
}

const Suggestions: React.FC<Props> = ({ onSuggestionClicked, disabled }) => (
  <Box display="flex" flexDirection="column" gap={2} mt={2} alignItems="center">
    <Typography variant="h5">Try asking:</Typography>
    {suggestions.map((s, i) => (
      <Button key={i} variant="outlined" onClick={() => onSuggestionClicked(s)} disabled={disabled}>
        {s}
      </Button>
    ))}
  </Box>
);

export default Suggestions;