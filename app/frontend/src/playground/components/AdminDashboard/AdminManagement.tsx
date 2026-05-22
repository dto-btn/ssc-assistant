/**
 * Admin user management panel.
 *
 * Lists current dashboard admins and allows adding / removing them.
 */

import React from "react";
import {
  Box,
  Typography,
  Button,
  TextField,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  CircularProgress,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "../../store/hooks";
import {
  addAdminUser,
  loadAdminList,
  removeAdminUser,
} from "../../store/thunks/adminThunks";

const AdminManagement: React.FC = () => {
  const { t } = useTranslation("playground");
  const dispatch = useAppDispatch();
  const adminList = useAppSelector((s) => s.admin.adminList);
  const isLoading = useAppSelector((s) => s.admin.isLoading);

  const [oid, setOid] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [email, setEmail] = React.useState("");

  React.useEffect(() => {
    dispatch(loadAdminList());
  }, [dispatch]);

  const handleAdd = () => {
    if (!oid.trim()) return;
    dispatch(addAdminUser(oid.trim(), displayName.trim(), email.trim()));
    setOid("");
    setDisplayName("");
    setEmail("");
  };

  return (
    <Box>
      <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
        {t("admin.management.title")}
      </Typography>

      {/* Add admin form */}
      <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
        <TextField
          size="small"
          label={t("admin.management.oid")}
          value={oid}
          onChange={(e) => setOid(e.target.value)}
          required
          sx={{ minWidth: 260 }}
        />
        <TextField
          size="small"
          label={t("admin.management.display_name")}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          sx={{ minWidth: 180 }}
        />
        <TextField
          size="small"
          label={t("admin.management.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          sx={{ minWidth: 200 }}
        />
        <Button
          variant="contained"
          size="small"
          onClick={handleAdd}
          disabled={!oid.trim() || isLoading}
        >
          {t("admin.management.add")}
        </Button>
      </Box>

      <Divider sx={{ mb: 1 }} />

      {isLoading && adminList.length === 0 ? (
        <CircularProgress size={24} />
      ) : (
        <List dense>
          {adminList.map((admin) => (
            <ListItem key={admin.oid} divider>
              <ListItemText
                primary={admin.display_name || admin.oid}
                secondary={[admin.email, admin.oid]
                  .filter(Boolean)
                  .join(" · ")}
              />
              <ListItemSecondaryAction>
                <IconButton
                  edge="end"
                  aria-label={t("admin.management.remove")}
                  onClick={() => dispatch(removeAdminUser(admin.oid))}
                  size="small"
                >
                  <DeleteIcon fontSize="small" />
                </IconButton>
              </ListItemSecondaryAction>
            </ListItem>
          ))}
          {adminList.length === 0 && (
            <ListItem>
              <ListItemText
                primary={t("admin.management.empty")}
                primaryTypographyProps={{ color: "text.secondary" }}
              />
            </ListItem>
          )}
        </List>
      )}
    </Box>
  );
};

export default AdminManagement;
