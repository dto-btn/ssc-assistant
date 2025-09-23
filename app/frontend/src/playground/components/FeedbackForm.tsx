import React, { useState } from "react";
import { Button, Dialog, DialogTitle, DialogContent, DialogActions, TextField } from "@mui/material";

const FeedbackForm: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [feedback, setFeedback] = useState("");

  return (
    <>
      <Button onClick={() => setOpen(true)} sx={{ position: "fixed", right: 16, bottom: 16, zIndex: 2000 }}>Feedback</Button>
      <Dialog open={open} onClose={() => setOpen(false)}>
        <DialogTitle>Feedback</DialogTitle>
        <DialogContent>
          <TextField
            label="Your feedback"
            value={feedback}
            onChange={e => setFeedback(e.target.value)}
            multiline
            rows={4}
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => {
              // TODO: save/send feedback
              setFeedback("");
              setOpen(false);
            }}
            disabled={!feedback.trim()}
          >
            Send
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default FeedbackForm;