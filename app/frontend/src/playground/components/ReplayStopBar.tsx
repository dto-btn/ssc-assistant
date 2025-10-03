/**
 * ReplayStopBar component
 *
 * Small control bar used during replay sessions to pause/stop and show
 * playback controls. Used by the session replay feature in the playground.
 */

import React from "react";
import { Box, Button } from "@mui/material";
import { useTranslation } from 'react-i18next';

interface Props {
  onReplay: () => void;
  onStop: () => void;
  isLoading: boolean;
  disabled: boolean;
}

const ReplayStopBar: React.FC<Props> = ({ onReplay, onStop, isLoading, disabled }) => {
  const { t } = useTranslation('playground');

  return (
    <Box display="flex" justifyContent="flex-end" gap={2} p={1}>
      <Button variant="outlined" onClick={onReplay} disabled={disabled || isLoading}>
        {t("replay")}
      </Button>
      <Button variant="outlined" onClick={onStop} disabled={!isLoading} color="error">
        {t("stop")}
      </Button>
    </Box>
  );
};

export default ReplayStopBar;