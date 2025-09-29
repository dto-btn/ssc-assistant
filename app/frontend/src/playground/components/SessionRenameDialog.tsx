/**
 * SessionRenameDialog component
 *
 * Modal dialog used to rename a saved playground session. Validates the new
 * name and dispatches session rename actions to the playground store.
 */

import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";
import { tt } from "../i18n/tt";

interface Props {
  open: boolean;
  initialValue: string;
  onClose: () => void;
  onRename: (newName: string) => void;
}

const SessionRenameDialog: React.FC<Props> = ({ open, initialValue, onClose, onRename }) => {
  const [name, setName] = useState(initialValue);

  React.useEffect(() => {
    setName(initialValue);
  }, [initialValue, open]);

  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>{tt("rename.conversation")}</DialogTitle>
      <DialogContent>
        <TextField
          value={name}
          onChange={event => setName(event.target.value)}
          label={tt("conversation.name")}
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>{tt("cancel")}</Button>
        <Button onClick={() => { onRename(name); onClose(); }} variant="contained" disabled={!name.trim()}>
          {tt("rename")}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionRenameDialog;