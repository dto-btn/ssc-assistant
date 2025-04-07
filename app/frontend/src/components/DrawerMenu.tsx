import DeleteIcon from "@mui/icons-material/Delete";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import LogoutIcon from "@mui/icons-material/Logout";
import { useIsAuthenticated } from "@azure/msal-react";
import { useEffect, useRef, useState } from "react";
import AddCommentIcon from "@mui/icons-material/AddComment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";
import React from "react";

interface DrawerMenuProps {
  chatDescriptions: string[];
  currentChatIndex: number;
  onClearChat: () => void;
  logout: () => void;
  handleDeleteSavedChat: (index: number) => void;
  handleLoadSavedChat: (index: number) => void;
  renameChat: (newChatDescription: string, index: number) => void;
  onNewChat: () => void;
}

export const DrawerMenu = ({
  chatDescriptions,
  onClearChat,
  logout,
  handleDeleteSavedChat,
  handleLoadSavedChat,
  renameChat,
  currentChatIndex,
  onNewChat
}: DrawerMenuProps) => {
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(
    null
  );
  const [selectedChatIndex, setSelectedChatIndex] = useState<null | number>(
    null
  );
  const [editedDescription, setEditedDescription] = useState("");
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [textFieldIsFocused, setTextFieldIsFocused] = useState(false);

  const isAuthenticated = useIsAuthenticated();
  const moreMenuOpen = Boolean(moreMenuAnchor);
  const { t } = useTranslation();
  const textFieldRef = useRef<HTMLDivElement>(null);

  const handleMoreMenuClick = (
    event: React.MouseEvent<HTMLButtonElement>,
    index: number
  ) => {
    setMoreMenuAnchor(event.currentTarget);
    setSelectedChatIndex(index);
  };

  const handleDeleteChatClicked = () => {
    if (selectedChatIndex !== null) {
      handleDeleteSavedChat(selectedChatIndex);
      setMoreMenuAnchor(null);
    }
  };

  const handleRenameClicked = () => {
    if (selectedChatIndex !== null && chatDescriptions[selectedChatIndex]) {
      setEditedDescription("");
    }
    setEditingIndex(selectedChatIndex);
    setTextFieldIsFocused(true);
    setMoreMenuAnchor(null);
  };

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      renameChat(editedDescription, editingIndex);
      setEditingIndex(null);
      setSelectedChatIndex(null);
      setEditedDescription("");
      setTextFieldIsFocused(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedChatIndex(null);
    setEditingIndex(null);
    setEditedDescription("");
    setTextFieldIsFocused(false);
  };

  // timeout prevent the blur from occuring immediately when it shouldn't
  const handleBlur = () => {
    setTimeout(() => {
      if (textFieldIsFocused) {
        handleSaveEdit();
      }
    }, 100);
  };
  // focus the text field when a user renames a chat
  useEffect(() => {
    if (editingIndex !== null && textFieldRef.current) {
      textFieldRef.current.focus();
      setTextFieldIsFocused(true);
    }
  }, [editingIndex]);

  // const tools = Object.keys(enabledTools).filter((tool) =>
  //   allowedToolsSet.has(tool)
  // );
  // Separate the corporate key
  // const corporateKeyIndex = tools.indexOf("corporate");
  // const corporateKey =
  //   corporateKeyIndex > -1 ? tools.splice(corporateKeyIndex, 1)[0] : null;

  const list = () => (
    <Box
      role="presentation"
      sx={{
        width: 300,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
      }}
    >
      <List>
        <ListItem key="newChat" disablePadding>
          <ListItemButton onClick={() => onNewChat()}>
            <ListItemIcon>
              <AddCommentIcon />
            </ListItemIcon>
            <ListItemText
              primary={t("new.conversation")}
              aria-description={t("new.conversation.aria.description")}
              aria-label={t("new.conversation")}
            />
          </ListItemButton>
        </ListItem>
        <ListItem key="clearchat" disablePadding>
          <ListItemButton onClick={onClearChat}>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText
              primary={t("clear.conversation")}
              aria-label={t("clear.conversation")}
            />
          </ListItemButton>
        </ListItem>
        <Divider sx={{ margin: "5px 0px" }}>
          <Chip
            label={t("drawer.header.conversations")}
            size="small"
            sx={{ backgroundColor: "transparent" }}
          />
        </Divider>
        <Collapse in={true} timeout="auto" unmountOnExit>
          {chatDescriptions.map((chatDescription, index) => {
            return (
              <ListItem
                key={index}
                sx={{
                  display: "flex",
                  flexDirection: "row",
                  padding: "2px 0px",
                  backgroundColor:
                    index === currentChatIndex ? "lightgray" : "transparent",
                  "&:hover": {
                    backgroundColor: "lightgrey",
                  },
                  transition: "none",
                }}
              >
                {(editingIndex === null || editingIndex !== index) && (
                  <ListItemButton
                    disableRipple
                    sx={{
                      padding: "5px 10px",
                      "&:hover": {
                        backgroundColor: "transparent",
                      },
                    }}
                    onClick={() => handleLoadSavedChat(index)}
                  >
                    <Typography
                      noWrap
                      sx={{
                        width: "100%",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {chatDescription}
                    </Typography>
                  </ListItemButton>
                )}
                <IconButton
                  onClick={(event) => handleMoreMenuClick(event, index)}
                  disableRipple
                  id="chat-history-options-button"
                  aria-label="more"
                  aria-controls={moreMenuOpen ? "chat-history-menu" : undefined}
                  aria-expanded={moreMenuOpen ? "true" : undefined}
                  aria-haspopup="true"
                  sx={{
                    "&:hover": {
                      backgroundColor: "transparent",
                      color: "black",
                    },
                  }}
                >
                  <Tooltip
                    title="Options"
                    placement="top"
                    slotProps={{
                      popper: {
                        sx: {
                          "& .MuiTooltip-tooltip": {
                            backgroundColor: "black",
                            color: "white",
                          },
                        },
                        modifiers: [
                          {
                            name: "offset",
                            options: {
                              offset: [0, 5],
                            },
                          },
                        ],
                      },
                    }}
                  >
                    <MoreHorizIcon />
                  </Tooltip>
                </IconButton>
                <Menu
                  id="chat-history-menu"
                  MenuListProps={{
                    "aria-labelledby": "chat-history-options-button",
                  }}
                  anchorEl={moreMenuAnchor}
                  open={moreMenuOpen}
                  onClose={() => setMoreMenuAnchor(null)}
                  transformOrigin={{
                    vertical: "top",
                    horizontal: "center",
                  }}
                  sx={{
                    "& .MuiPaper-root": {
                      marginLeft: "-25px", // Move the menu to the left a bit
                    },
                  }}
                >
                  <MenuItem onClick={handleDeleteChatClicked}>
                    <DeleteIcon sx={{ color: "red", mr: "15px" }} />
                    <Typography sx={{ color: "red" }}>{t("delete")}</Typography>
                  </MenuItem>
                  <MenuItem onClick={handleRenameClicked}>
                    <EditIcon sx={{ mr: "15px" }} />
                    <Typography>{t("rename")}</Typography>
                  </MenuItem>
                </Menu>

                {editingIndex !== null && editingIndex === index && (
                  <TextField
                    inputRef={textFieldRef}
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleSaveEdit();
                      if (e.key === "Escape") handleCancelEdit();
                    }}
                    onBlur={handleBlur}
                    sx={{
                      flexGrow: "1",
                      mr: "5px",
                      "& .MuiInputBase-input": {
                        padding: "5px 10px",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      },
                    }}
                  />
                )}


              </ListItem>
            );
          })}
        </Collapse>
      </List>
      <List sx={{ marginTop: "auto" }}>
        {isAuthenticated && (
          <ListItem key="logout" disablePadding>
            <ListItemButton onClick={logout}>
              <ListItemIcon>
                <LogoutIcon />
              </ListItemIcon>
              <ListItemText primary={t("logout")} />
            </ListItemButton>
          </ListItem>
        )}
      </List>
    </Box>
  );

  return (
    <>
      {list()}
    </>
    // </Drawer>
  );
};
