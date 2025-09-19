import React from "react";
import { Box, Button } from "@mui/material";

interface Props {
  onReplay: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const ReplayStopBar: React.FC<Props> = ({ onReplay, onStop, isLoading, disabled }) => (
  <Box display="flex" justifyContent="flex-end" gap={2} p={1}>
    <Button variant="outlined" onClick={onReplay} disabled={disabled || isLoading}>
      Replay
    </Button>
    <Button variant="outlined" onClick={onStop} disabled={!isLoading} color="error">
      Stop
    </Button>
  </Box>
);

export default ReplayStopBar;