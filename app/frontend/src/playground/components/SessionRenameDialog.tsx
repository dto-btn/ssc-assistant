/**
 * SessionRenameDialog component
 *
 * Modal dialog used to rename a saved playground session. Validates the new
 * name and dispatches session rename actions to the playground store.
 */

import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";
import { useTranslation } from 'react-i18next';

interface Props {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

const SessionRenameDialog: React.FC<Props> = ({ open, initialValue, onClose, onRename }) => {
  const { t } = useTranslation('playground');
  const [name, setName] = useState(initialValue);

  React.useEffect(() => {
    setName(initialValue);
  }, [initialValue, open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{t("rename.conversation")}</DialogTitle>
      <DialogContent>
        <TextField
          value={name}
          onChange={event => setName(event.target.value)}
          label={t("conversation.name")}
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{t("cancel")}</Button>
        <Button onClick={() => { onRename(name); onClose(); }} variant="contained" disabled={!name.trim()}>
          {t("rename")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionRenameDialog;