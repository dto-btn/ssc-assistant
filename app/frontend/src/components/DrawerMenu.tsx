import LanguageIcon from "@mui/icons-material/Language";
import DeleteIcon from "@mui/icons-material/Delete";
import PsychologyIcon from "@mui/icons-material/Psychology";
import {
  Box,
  Chip,
  Collapse,
  Divider,
  FormControlLabel,
  FormGroup,
  IconButton,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from "@mui/material";
import Drawer from "@mui/material/Drawer";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import { changeLanguage } from "i18next";
import LogoutIcon from "@mui/icons-material/Logout";
import { useIsAuthenticated } from "@azure/msal-react";
import Handyman from "@mui/icons-material/Handyman";
import { useEffect, useRef, useState } from "react";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import HistoryIcon from "@mui/icons-material/History";
import AddCommentIcon from "@mui/icons-material/AddComment";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import EditIcon from "@mui/icons-material/Edit";
import { useTranslation } from "react-i18next";
import React from "react";
import { allowedToolsSet, allowedCorporateFunctionsSet } from "../allowedTools";
import FormLabel from "@mui/material/FormLabel";
import { LEFT_MENU_WIDTH } from "../constants/frameDimensions";

interface DrawerMenuProps {
  openDrawer: boolean;
  chatDescriptions: string[];
  currentChatIndex: number;
  onClearChat: () => void;
  onNewChat: () => void;
  setLangCookie: () => void;
  logout: () => void;
  enabledTools: Record<string, boolean>;
  selectedModel: string;
  handleUpdateEnabledTools: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  handleSetSelectedCorporateFunction: (
    event: React.ChangeEvent<HTMLInputElement>
  ) => void;
  selectedCorporateFunction: string;
  handleSelectedModelChanged: (modelName: string) => void;
  handleDeleteSavedChat: (index: number) => void;
  handleLoadSavedChat: (index: number) => void;
  renameChat: (newChatDescription: string, index: number) => void;
}

export const DrawerMenu = ({
  openDrawer,
  chatDescriptions,
  onClearChat,
  onNewChat,
  setLangCookie,
  logout,
  enabledTools,
  handleUpdateEnabledTools,
  handleSetSelectedCorporateFunction,
  selectedCorporateFunction,
  handleSelectedModelChanged,
  selectedModel,
  handleDeleteSavedChat,
  handleLoadSavedChat,
  renameChat,
  currentChatIndex,
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
  const [selectChatMenuOpen, setSelectChatMenuOpen] = useState(false);

  const isAuthenticated = useIsAuthenticated();
  const moreMenuOpen = Boolean(moreMenuAnchor);
  const { t } = useTranslation();
  const textFieldRef = useRef<HTMLDivElement>(null);

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectedModelChanged((event.target as HTMLInputElement).value);
  };

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

  const tools = Object.keys(enabledTools).filter((tool) =>
    allowedToolsSet.has(tool)
  );
  // Separate the corporate key
  const corporateKeyIndex = tools.indexOf("corporate");
  const corporateKey =
    corporateKeyIndex > -1 ? tools.splice(corporateKeyIndex, 1)[0] : null;

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
        <ListItem key="language" disablePadding>
          <ListItemButton
            onClick={() => {
              changeLanguage(t("langlink.shorthand"));
              setLangCookie();
            }}
          >
            <ListItemIcon>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText primary={t("langlink")} />
          </ListItemButton>
        </ListItem>
        <Divider sx={{ margin: "5px 0px" }}>
          <Chip
            label={t("drawer.header.toolsAndModels")}
            size="small"
            sx={{ backgroundColor: "transparent" }}
          />
        </Divider>
        <ListItem key="toolSettings" disablePadding>
          <ListItem
            aria-expanded={true}
          >
            <ListItemIcon>
              <Handyman />
            </ListItemIcon>
            <ListItemText primary={t("menu.chooseTools")} />
          </ListItem>
        </ListItem>
        <Collapse in={true} timeout="auto" unmountOnExit>
          <Divider />
          <FormGroup>
            {corporateKey && (
              <Box
                sx={{
                  minWidth: 120,
                  marginLeft: "70px",
                  marginRight: "10px",
                  paddingTop: "5px",
                }}
              >
                <FormLabel id="corpo-data-label">
                  {t("corporate.data")}
                </FormLabel>
                <RadioGroup
                  aria-labelledby="corpo-data-label"
                  name="corpo-data-group"
                  onChange={handleSetSelectedCorporateFunction}
                  value={selectedCorporateFunction}
                  defaultValue="intranet_question"
                >
                  <FormControlLabel
                    key={-1}
                    value="none"
                    control={<Radio />}
                    label={t("none")}
                  />
                  {Array.from(allowedCorporateFunctionsSet).map(
                    (name, index) => (
                      <FormControlLabel
                        key={index}
                        value={name}
                        control={<Radio />}
                        label={t(name)}
                      />
                    )
                  )}
                </RadioGroup>
              </Box>
            )}
            <Divider />
            {tools.map((tool, index) => {
              return (
                <FormControlLabel
                  label={t(tool)}
                  key={index}
                  control={
                    <Switch
                      checked={enabledTools[tool]}
                      onChange={handleUpdateEnabledTools}
                      name={tool}
                      sx={{
                        marginLeft: "70px",
                        marginRight: "10px",
                        color: "primary.main",
                      }}
                    />
                  }
                />
              );
            })}
          </FormGroup>
        </Collapse>
        <ListItem key="modelSelection" disablePadding>
          <ListItem
            aria-expanded={true}
          >
            <ListItemIcon>
              <PsychologyIcon />
            </ListItemIcon>
            <ListItemText>{t("model.version.select")}</ListItemText>
          </ListItem>
        </ListItem>
        <Collapse in={true} timeout="auto" unmountOnExit>
          <Divider />
          <RadioGroup
            defaultValue="gpt-4o"
            aria-labelledby="select-language-model-radio"
            name="model-radios"
            sx={{ marginLeft: "70px" }}
            value={selectedModel}
            onChange={handleRadioChange}
          >
            <FormControlLabel
              value="gpt-4o"
              control={<Radio />}
              label="GPT-4o"
            />
            <FormControlLabel
              value="gpt-35-turbo-1106"
              control={<Radio />}
              label="GPT-3.5 Turbo"
            />
          </RadioGroup>
        </Collapse>
        <Divider sx={{ margin: "5px 0px" }}>
          <Chip
            label={t("drawer.header.conversations")}
            size="small"
            sx={{ backgroundColor: "transparent" }}
          />
        </Divider>
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
        <ListItem key="newChat" disablePadding>
          <ListItemButton onClick={onNewChat}>
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
        <ListItem key="chatSelection" disablePadding>
          <ListItemButton
            onClick={() => setSelectChatMenuOpen(!selectChatMenuOpen)}
            aria-expanded={selectChatMenuOpen}
          >
            <ListItemIcon>
              <HistoryIcon />
            </ListItemIcon>
            <ListItemText>{t("select.conversation")}</ListItemText>
            {selectChatMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        </ListItem>
        <Collapse in={selectChatMenuOpen} timeout="auto" unmountOnExit>
          <Divider />
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
    <Drawer
      open={openDrawer}
      variant="persistent"
      sx={{
        display: { xs: 'none', sm: 'block' },
        '& .MuiDrawer-paper': { boxSizing: 'border-box', width: `${LEFT_MENU_WIDTH}px` },
      }}

    >
      {list()}
    </Drawer>
  );
};
