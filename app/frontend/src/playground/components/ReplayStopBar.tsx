/**
 * ReplayStopBar component
 *
 * Small control bar used during replay sessions to pause/stop and show
 * playback controls. Used by the session replay feature in the playground.
 */

import React from "react";
import { Box, Button, CircularProgress } from "@mui/material";
import PictureAsPdfIcon from "@mui/icons-material/PictureAsPdf";
import { useTranslation } from 'react-i18next';

interface Props {
  onReplay: () => void;
  onStop: () => void;
  onDownload: () => void;
  isLoading: boolean;
  disabled: boolean;
  downloadDisabled: boolean;
  isExporting: boolean;
}

const ReplayStopBar: React.FC<Props> = ({ onReplay, onStop, onDownload, isLoading, disabled, downloadDisabled, isExporting }) => {
  const { t } = useTranslation('playground');

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap" p={1}>
      <Button
        variant="contained"
        color="primary"
        startIcon={!isExporting ? <PictureAsPdfIcon /> : undefined}
        onClick={onDownload}
        disabled={downloadDisabled || isExporting}
      >
        {isExporting ? <CircularProgress size={16} color="inherit" /> : t("download.pdf")}
      </Button>
      <Box display="flex" gap={2}>
        <Button variant="outlined" onClick={onReplay} disabled={disabled || isLoading}>
          {t("replay")}
        </Button>
        <Button variant="outlined" onClick={onStop} disabled={!isLoading} color="error">
          {t("stop")}
        </Button>
      </Box>
    </Box>
  );
};

export default ReplayStopBar;