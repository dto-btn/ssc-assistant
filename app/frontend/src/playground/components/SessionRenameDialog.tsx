import React, { useState } from "react";
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, TextField } from "@mui/material";

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
      <DialogTitle>Rename Conversation</DialogTitle>
      <DialogContent>
        <TextField
          value={name}
          onChange={e => setName(e.target.value)}
          label="Conversation Name"
          fullWidth
          autoFocus
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button onClick={() => { onRename(name); onClose(); }} variant="contained" disabled={!name.trim()}>
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default SessionRenameDialog;