import React, { useEffect, useMemo, useState } from "react";
import { Box, Button, Divider, IconButton, List, ListItem, ListItemText, Stack, TextField, Typography } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CloudDownloadIcon from "@mui/icons-material/CloudDownload";
import DriveFolderUploadIcon from "@mui/icons-material/DriveFolderUpload";
import EditIcon from "@mui/icons-material/Edit";
import { createBlobViaApi, deleteBlob, listMyBlobs, readBlob, renameBlobLabel, updateBlobMetadata } from "../api/storage";
import { useMsal } from "@azure/msal-react";
import { apiUse } from "../../authConfig";
import { useDispatch } from "react-redux";
import { setAccessToken as setAccessTokenAction } from "../store/slices/authSlice";

const StorageManager: React.FC = () => {
  const { instance, accounts } = useMsal();
  const dispatch = useDispatch();
  const [accessToken, setLocalAccessToken] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [blobs, setBlobs] = useState<Awaited<ReturnType<typeof listMyBlobs>>>([]);

  const account = useMemo(() => accounts[0] ?? null, [accounts]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setError(null);
        const res = await instance.acquireTokenSilent({ scopes: apiUse.scopes as string[], account: account ?? undefined });
        if (mounted) {
          setLocalAccessToken(res.accessToken);
          dispatch(setAccessTokenAction(res.accessToken));
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Failed to acquire token";
        setError(msg);
      }
    })();
    return () => { mounted = false; };
  }, [instance, account, dispatch]);

  const refresh = React.useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError(null);
    try {
      const items = await listMyBlobs(accessToken);
      setBlobs(items);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => { if (accessToken) refresh(); }, [accessToken, refresh]);

  const onUpload = async (file: File) => {
    try {
      setError(null);
      const b64 = await fileToDataUrl(file);
      const result = await createBlobViaApi({ encodedFile: b64, name: file.name, accessToken });
      // Best-effort standardized metadata tagging for RAG
      try {
        await updateBlobMetadata({
          blobName: result.blobName,
          metadata: {
            type: "user-file",
            originalname: file.name,
            uploadedat: new Date().toISOString(),
          },
          accessToken,
        });
      } catch {
        // ignore tagging errors
      }
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  const onDelete = async (name: string) => {
    try {
      setError(null);
      await deleteBlob({ blobName: name, accessToken });
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  const onDownload = async (name: string) => {
    try {
      setError(null);
      const blob = await readBlob({ blobName: name, accessToken });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  const [renameTarget, setRenameTarget] = useState<string>("");
  const [newLabel, setNewLabel] = useState<string>("");
  const onRenameLabel = async () => {
    if (!renameTarget || !newLabel) return;
    try {
      setError(null);
      await renameBlobLabel({ blobName: renameTarget, newLabel, accessToken });
      setRenameTarget("");
      setNewLabel("");
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
    }
  };

  return (
    <Box p={2} sx={{ width: "100%", maxWidth: 900, mx: "auto" }}>
      <Typography variant="h5" gutterBottom>Storage Manager</Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Uses secured API for upload and SAS-proxied blob routes for read/update/delete, gated by your API access token oid.
      </Typography>

      <Stack direction="row" spacing={2} alignItems="center" my={2}>
        <Button component="label" startIcon={<DriveFolderUploadIcon/>} variant="contained">
          Upload
          <input hidden type="file" onChange={(e) => {
            const f = e.target.files?.[0]; if (f) onUpload(f);
          }}/>
        </Button>
        <Button onClick={refresh} disabled={loading} variant="outlined">Refresh</Button>
      </Stack>

      <Divider sx={{ my: 2 }} />

      <Stack direction="row" spacing={1} alignItems="center" my={1}>
        <TextField size="small" label="Blob name" value={renameTarget} onChange={(e) => setRenameTarget(e.target.value)} />
        <TextField size="small" label="New label (metadata)" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} />
        <Button startIcon={<EditIcon/>} onClick={onRenameLabel} variant="outlined">Update label</Button>
      </Stack>

      {error && (
        <Typography color="error" variant="body2" sx={{ my: 1 }}>{error}</Typography>
      )}

      <List dense>
        {blobs.map((b) => (
          <ListItem key={b.name}
            secondaryAction={
              <Stack direction="row" spacing={1}>
                <IconButton onClick={() => onDownload(b.name)} size="small" color="primary"><CloudDownloadIcon/></IconButton>
                <IconButton onClick={() => onDelete(b.name)} size="small" color="error"><DeleteIcon/></IconButton>
              </Stack>
            }
          >
            <ListItemText primary={b.name} secondary={`type=${b.contentType || ""} size=${b.contentLength ?? ""} label=${b.metadata?.label ?? ""}`}/>
          </ListItem>
        ))}
      </List>
    </Box>
  );
};

export default StorageManager;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
