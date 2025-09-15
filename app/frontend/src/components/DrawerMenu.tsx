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
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import SourceOutlinedIcon from "@mui/icons-material/SourceOutlined";
import { useEffect, useRef, useState } from "react";
import AddCommentIcon from "@mui/icons-material/AddComment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";
import React from "react";
import { allowedToolsSet } from "../allowedTools";

interface DrawerMenuProps {
  chatDescriptions: string[];
  currentChatIndex: number;
  handleDeleteSavedChat: (index: number) => void;
  handleLoadSavedChat: (index: number) => void;
  renameChat: (newChatDescription: string, index: number) => void;
  onNewChat: (tool?: string) => void;
}

export const DrawerMenu = ({
  chatDescriptions,
  handleDeleteSavedChat,
  handleLoadSavedChat,
  renameChat,
  currentChatIndex,
  onNewChat,
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

  const chatDescriptionsWithOriginalIndex: {
    chatDescription: string;
    originalIndex: number;
  }[] = chatDescriptions.map((chatDescription, index) => {
    return {
      chatDescription,
      originalIndex: index,
    };
  });

  const list = () => (
    <Box
      role="presentation"
      sx={{
        width: 300,
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowX: "hidden",
      }}
    >
      <List>
        <ListItem key="newChat" disablePadding>
          <ListItemButton onClick={() => onNewChat()}>
            <ListItemIcon sx={{ minWidth: "0px", marginRight: "10px" }}>
              <AddCommentIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={t("new.conversation")}
              aria-description={t("new.conversation.aria.description")}
              aria-label={t("new.conversation")}
            />
          </ListItemButton>
        </ListItem>
        <ListItem key="newchat-bits" disablePadding>
          <ListItemButton onClick={() => onNewChat("bits")}>
            <ListItemIcon sx={{ minWidth: "0px", marginRight: "10px" }}>
              <ReceiptLongIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText
              primary={t("new.conversation.br")}
              aria-description={t("new.conversation.br.aria.description")}
              aria-label={t("new.conversation.br")}
            />
          </ListItemButton>
        </ListItem>
        {allowedToolsSet.has("pmcoe") && (
          <ListItem key="newchat-pmcoe" disablePadding>
            <ListItemButton onClick={() => onNewChat("pmcoe")}>
              <ListItemIcon sx={{ minWidth: "0px", marginRight: "10px" }}>
                <SourceOutlinedIcon fontSize="small" color="primary" />
              </ListItemIcon>
              <ListItemText
                primary={t("new.conversation.pmcoe")}
                aria-description={t("new.conversation.br.aria.description")}
                aria-label={t("new.conversation.pmcoe")}
              />
            </ListItemButton>
          </ListItem>
        )}
        <Divider sx={{ margin: "5px 0px" }}>
          <Chip
            label={t("drawer.header.conversations")}
            size="small"
            sx={{ backgroundColor: "transparent" }}
          />
        </Divider>
        <Collapse in={true} timeout="auto" unmountOnExit>
          {chatDescriptionsWithOriginalIndex
            .reverse()
            .map(({ chatDescription, originalIndex: index }) => {
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
                    // Hide the more button by default; show on hover or focus within for accessibility
                    "& .more-button": {
                      opacity: 0,
                      transition: "opacity 0.15s ease-in-out",
                    },
                    "&:hover .more-button, &:focus-within .more-button": {
                      opacity: 1,
                    },
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
                    className="more-button"
                    onClick={(event) => handleMoreMenuClick(event, index)}
                    id="chat-history-options-button"
                    aria-label="more"
                    aria-controls={
                      moreMenuOpen ? "chat-history-menu" : undefined
                    }
                    aria-expanded={moreMenuOpen ? "true" : undefined}
                    aria-haspopup="true"
                    sx={{
                      marginRight: "10px",
                      "&:hover": {
                        backgroundColor: "transparent",
                        color: "black",
                      },
                    }}
                  >
                    <Tooltip
                      tabIndex={-1}
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
                      <MoreHorizIcon tabIndex={-1} />
                    </Tooltip>
                  </IconButton>
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
        {/* Single shared Menu to avoid multiple overlapping Menus causing stacked shadows */}
        <Menu
          id="chat-history-menu"
          MenuListProps={{
            "aria-labelledby": "chat-history-options-button",
          }}
          anchorEl={moreMenuAnchor}
          open={moreMenuOpen}
          onClose={() => setMoreMenuAnchor(null)}
        >
          <MenuItem onClick={handleDeleteChatClicked} tabIndex={0}>
            <DeleteIcon sx={{ mr: "15px" }} />
            <Typography>{t("delete")}</Typography>
          </MenuItem>
          <MenuItem onClick={handleRenameClicked} tabIndex={0}>
            <EditIcon sx={{ mr: "15px" }} />
            <Typography>{t("rename")}</Typography>
          </MenuItem>
        </Menu>
      </List>
    </Box>
  );

  return (
    <>{list()}</>
    // </Drawer>
  );
};
