/**
 * FileUpload component
 *
 * Handles file selection and upload UI inside the playground. Integrates with
 * the app's upload endpoint and shows progress/status to the user. Intended
 * for development/testing of file-based RAG flows.
 */

import React from "react";
import { Button } from "@mui/material";

interface FileUploadProps {
  onFiles: (files: FileList) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onFiles }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        type="file"
        multiple
        hidden
        ref={inputRef}
        onChange={event => {
          if (event.target.files) onFiles(event.target.files);
        }}
      />
      <Button
        variant="outlined"
        size="small"
        onClick={() => inputRef.current?.click()}
        sx={{ minWidth: 80 }}
      >
        Attach
      </Button>
    </>
  );
};

export default FileUpload;