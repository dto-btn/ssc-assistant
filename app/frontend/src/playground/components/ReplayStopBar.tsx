/**
 * ReplayStopBar component
 *
 * Small control bar used during replay sessions to pause/stop and show
 * playback controls. Used by the session replay feature in the playground.
 */

import React from "react";
import { Box, Button, CircularProgress, Link } from "@mui/material";
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

  const handleDownloadClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    if (downloadDisabled || isExporting) {
      event.preventDefault();
      return;
    }
    onDownload();
  };

  return (
    <Box display="flex" justifyContent="space-between" alignItems="center" gap={2} flexWrap="wrap" p={1}>
      <Link
        component="button"
        type="button"
        underline="hover"
        onClick={handleDownloadClick}
        aria-disabled={downloadDisabled || isExporting}
        sx={{
          display: "inline-flex",
          alignItems: "center",
          gap: 1,
          cursor: downloadDisabled || isExporting ? "not-allowed" : "pointer",
          opacity: downloadDisabled || isExporting ? 0.5 : 1,
          fontWeight: 400,
          fontSize: "0.875rem",
        }}
      >
        {isExporting && <CircularProgress size={14} thickness={5} />}
        {t("download.pdf")}
      </Link>
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