import LanguageIcon from "@mui/icons-material/Language";
import DeleteIcon from '@mui/icons-material/Delete';
import PsychologyIcon from '@mui/icons-material/Psychology';
import {
  Box,
  Chip,
  Collapse,
  Divider,
  Drawer,
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
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { changeLanguage } from "i18next";
import LogoutIcon from '@mui/icons-material/Logout';
import { useIsAuthenticated } from "@azure/msal-react";
import Handyman from "@mui/icons-material/Handyman";
import { useEffect, useRef, useState } from "react";
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import InfoIcon from '@mui/icons-material/Info';
import HistoryIcon from '@mui/icons-material/History';
import AddCommentIcon from '@mui/icons-material/AddComment';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import EditIcon from '@mui/icons-material/Edit';
import { useTranslation } from "react-i18next";
import React from "react";

interface DrawerMenuProps {
  openDrawer: boolean;
  savedChatHistories: ChatHistory[];
  currentChatIndex: number;
  toggleDrawer: (arg: boolean) => void;
  onClearChat: () => void;
  onNewChat: () => void;
  setLangCookie: () => void;
  logout: () => void;
  enabledTools: Record<string, boolean>;
  selectedModel: string;
  handleUpdateEnabledTools: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectedModelChanged: (modelName: string) => void;
  tutorialBubbleNumber?: number;
  handleToggleTutorials: (showTutorials?: boolean) => void;
  handleDeleteSavedChat: (index: number) => void;
  handleLoadSavedChat: (index: number) => void;
  renameChat: (newChatDescription: string, index: number) => void;
}

export const DrawerMenu = ({openDrawer, savedChatHistories, toggleDrawer, onClearChat, onNewChat, setLangCookie, 
  logout, enabledTools, handleUpdateEnabledTools, handleSelectedModelChanged, selectedModel, tutorialBubbleNumber, handleToggleTutorials,
  handleDeleteSavedChat, handleLoadSavedChat, renameChat, currentChatIndex} : DrawerMenuProps) => {
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [selectModelMenuOpen, setSelectModelMenuOpen] = useState(false);
  const [selectChatMenuOpen, setSelectChatMenuOpen] = useState(false);
  const [moreMenuAnchor, setMoreMenuAnchor] = useState<null | HTMLElement>(null);
  const [selectedChatIndex, setSelectedChatIndex] = useState<null | number>(null);
  const [editedDescription, setEditedDescription] = useState('');
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [textFieldIsFocused, setTextFieldIsFocused] = useState(false);

  const isAuthenticated = useIsAuthenticated();
  const moreMenuOpen = Boolean(moreMenuAnchor);
  const { t } = useTranslation();
  const textFieldRef = useRef<HTMLDivElement>(null);

  const toggleToolDrawerOpen = () => {
    setToolMenuOpen(!toolMenuOpen);
  }

  const toggleSelectModelMenuOpen = () => {
    setSelectModelMenuOpen(!selectModelMenuOpen);
  }

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectedModelChanged((event.target as HTMLInputElement).value);
  };

  const handleMoreMenuClick = (event: React.MouseEvent<HTMLButtonElement>, index: number) => {
    setMoreMenuAnchor(event.currentTarget);
    setSelectedChatIndex(index);
  };

  const handleCloseMoreMenu = () => {
    setMoreMenuAnchor(null);
  };

  const handleDeleteChatClicked = () => {
    if (selectedChatIndex !== null) {
      handleDeleteSavedChat(selectedChatIndex);
      setMoreMenuAnchor(null);
    }
  }

  const handleRenameClicked = () => {
    if (selectedChatIndex !== null && savedChatHistories[selectedChatIndex].description) {
      setEditedDescription(savedChatHistories[selectedChatIndex].description);
    }
    setEditingIndex(selectedChatIndex);
    setTextFieldIsFocused(true);
    handleCloseMoreMenu();
  }

  const handleSaveEdit = () => {
    if (editingIndex !== null) {
      renameChat(editedDescription, editingIndex)
      setEditingIndex(null);
      setSelectedChatIndex(null);
      setEditedDescription('');
      setTextFieldIsFocused(false);
    }
  };

  const handleCancelEdit = () => {
    setSelectedChatIndex(null);
    setEditingIndex(null);
    setEditedDescription('');
    setTextFieldIsFocused(false);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (textFieldIsFocused) {
        handleSaveEdit();
      }
    }, 100);
  };

  // use effect to close the collapses when the drawer is toggled closed
  useEffect(() => {
    if (!openDrawer) {
      setSelectModelMenuOpen(false);
      setToolMenuOpen(false);
      setSelectChatMenuOpen(false);
    }
  }, [openDrawer]);

  // Use effect for opening the collapses for tools/model selection with tutorials
  useEffect(() => {
    if (openDrawer && tutorialBubbleNumber) {
      switch (tutorialBubbleNumber) {
        case 2:
          setToolMenuOpen(true);
          setSelectModelMenuOpen(false);
          break;
        case 3:
          setToolMenuOpen(false);
          setSelectModelMenuOpen(true);
          break;
        case 4:
          setToolMenuOpen(false);
          setSelectModelMenuOpen(false);
          break;
        case 5:
          setSelectChatMenuOpen(false);
          break;
        case 6:
          setSelectChatMenuOpen(true);
          break;
        default:
          break;
      }
    }
  }, [tutorialBubbleNumber, openDrawer]);

  // focus the text field when a user renames a chat
  useEffect(() => {
    if (editingIndex !== null && textFieldRef.current) {
      textFieldRef.current.focus();
      setTextFieldIsFocused(true);
    }
  }, [editingIndex]);

  const list = () => (
    <Box role="presentation" 
      sx={{ 
        width: 300,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh',
     }}>
      <List>
        <ListItem key="language" disablePadding>
          <ListItemButton onClick={() => {
              changeLanguage(t("langlink.shorthand"));
              setLangCookie();
            }}>
            <ListItemIcon>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText primary={t("langlink")} />
          </ListItemButton>
        </ListItem>
        <Divider sx={{margin: '5px 0px'}}>
          <Chip label={t("drawer.header.toolsAndModels")} size="small" sx={{backgroundColor: 'transparent'}}/>
        </Divider>
        <ListItem key="toolSettings=" disablePadding>
          <ListItemButton onClick={toggleToolDrawerOpen} aria-expanded={toolMenuOpen}>
            <ListItemIcon>
              <Handyman />
            </ListItemIcon>
            <ListItemText primary={t("menu.chooseTools")}/>
            {toolMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        </ListItem>
        <Collapse in={toolMenuOpen} timeout="auto" unmountOnExit>
          <Divider />
          <FormGroup>
            {Object.keys(enabledTools).map((tool, index) => {
              return (
                <FormControlLabel 
                  label={t(tool)} key={index}
                  control={
                    <Switch 
                      checked={enabledTools[tool]}
                      onChange={handleUpdateEnabledTools} 
                      name={tool}
                      sx={{marginLeft: '70px', marginRight: '10px', color: "primary.main"}}
                    />
                  }
                />
              )
            })}
          </FormGroup>
        </Collapse>
        <ListItem key="modelSelection" disablePadding>
          <ListItemButton onClick={toggleSelectModelMenuOpen} aria-expanded={selectModelMenuOpen}>
            <ListItemIcon>
              <PsychologyIcon />
            </ListItemIcon>
            <ListItemText>
              {t("model.version.select")}
            </ListItemText>
            {selectModelMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        </ListItem>
        <Collapse in={selectModelMenuOpen} timeout="auto" unmountOnExit>
          <Divider />
          <RadioGroup
            defaultValue="gpt-4o"
            aria-labelledby="select-language-model-radio"
            name="model-radios"
            sx={{marginLeft: '70px'}}
            value={selectedModel}
            onChange={handleRadioChange}
          >
            <FormControlLabel value="gpt-4o" control={<Radio />} label="GPT-4o" />
            <FormControlLabel value="gpt-35-turbo-1106" control={<Radio />} label="GPT-3.5 Turbo" />
          </RadioGroup>
        </Collapse>
        <Divider sx={{margin: '5px 0px'}}>
          <Chip label={t("drawer.header.conversations")} size="small" sx={{backgroundColor: 'transparent'}}/>
        </Divider>
        <ListItem key="clearchat" disablePadding>
          <ListItemButton onClick={onClearChat}>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText primary={t("clear.conversation")} />
          </ListItemButton>
        </ListItem>
        <ListItem key="newChat" disablePadding>
          <ListItemButton onClick={onNewChat}>
            <ListItemIcon>
              <AddCommentIcon />
            </ListItemIcon>
            <ListItemText primary={t("new.conversation")} />
          </ListItemButton>
        </ListItem>
        <ListItem key="chatSelection" disablePadding>
          <ListItemButton onClick={() => setSelectChatMenuOpen(!selectChatMenuOpen)} aria-expanded={selectChatMenuOpen}>
            <ListItemIcon>
              <HistoryIcon />
            </ListItemIcon>
            <ListItemText>
              {t("select.conversation")}
            </ListItemText>
            {selectChatMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        </ListItem>
        <Collapse in={selectChatMenuOpen} timeout="auto" unmountOnExit>
          <Divider />
          {savedChatHistories.map((chatHistory, index) => {
            return (
              <ListItem key={index} 
                sx={{
                  display: 'flex', 
                  flexDirection: 'row', 
                  padding: '2px 0px', 
                  backgroundColor: index === currentChatIndex ? 'lightgray' : 'transparent',
                  '&:hover': {
                    backgroundColor: 'lightgrey',
                  },
                  transition: 'none'
                }}
              >
                <IconButton 
                  onClick={(event) => handleMoreMenuClick(event, index)}
                  disableRipple
                  id="chat-history-options-button"
                  aria-label="more"
                  aria-controls={moreMenuOpen ? 'chat-history-menu' : undefined}
                  aria-expanded={moreMenuOpen ? 'true' : undefined}
                  aria-haspopup="true"
                  sx={{                      
                    '&:hover': {
                    backgroundColor: 'transparent',
                    color: 'black'
                  },}}
                >
                  <Tooltip 
                    title="Options" 
                    placement="top"
                    PopperProps={{
                      sx: {
                        '& .MuiTooltip-tooltip': {
                          backgroundColor: 'black', 
                          color: 'white', 
                      }
                    }}}
                    slotProps={{
                      popper: {
                        modifiers: [
                          {
                            name: 'offset',
                            options: {
                              offset: [0, 5],
                            },
                          },
                        ],
                      },
                    }}
                  >
                    <MoreHorizIcon/>
                  </Tooltip>
                </IconButton>
                <Menu
                  id="chat-history-menu"
                  MenuListProps={{
                    'aria-labelledby': "chat-history-options-button"
                  }}
                  anchorEl={moreMenuAnchor}
                  open={moreMenuOpen}
                  onClose={handleCloseMoreMenu}
                  transformOrigin={{
                    vertical: 'top',
                    horizontal: 'center',
                  }}
                  sx={{
                    '& .MuiPaper-root': {
                      marginLeft: '-25px', // Move the menu to the left a bit
                    },
                  }}
                >
                  <MenuItem onClick={handleDeleteChatClicked}>
                    <DeleteIcon sx={{color: "red", mr: '15px'}}/>
                    <Typography sx={{color: "red"}}>{t("delete")}</Typography>
                  </MenuItem>
                  <MenuItem onClick={handleRenameClicked}>
                    <EditIcon sx={{mr: '15px'}}/>
                    <Typography>{t("rename")}</Typography>
                  </MenuItem>
                </Menu>

                {editingIndex !== null && editingIndex === index && (
                  <TextField
                    inputRef={textFieldRef}
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleSaveEdit();
                      if (e.key === 'Escape') handleCancelEdit();
                    }}
                    onBlur={handleBlur}
                    sx={{
                      flexGrow: '1',
                      mr: '5px',
                      '& .MuiInputBase-input': {
                        padding: '5px 10px',
                        overflow: "hidden",
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap'
                      }
                    }}
                  />
                )}

                {(editingIndex === null || editingIndex !== index) &&
                  <ListItemButton 
                    disableRipple
                    sx={{
                      padding: '5px 10px',
                      '&:hover': {
                        backgroundColor: 'transparent',
                      },
                    }} 
                    onClick={() => handleLoadSavedChat(index)}
                  >
                    <Typography
                      noWrap
                      sx={{
                        width: '100%',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {chatHistory.description ? chatHistory.description : "Conversation " + (index + 1)}
                    </Typography>
                  </ListItemButton>
                }

              </ListItem>
            )
          })}
        </Collapse>
      </List>
      <List sx={{marginTop: 'auto'}}>
        {!tutorialBubbleNumber && 
          (<ListItem key="tutorials" disablePadding>
            <ListItemButton onClick={() => handleToggleTutorials(true)}>
              <ListItemIcon>
                <InfoIcon />
              </ListItemIcon>
              <ListItemText primary={t("tutorial.view")} />
            </ListItemButton>
          </ListItem>)}
        {isAuthenticated &&
        (<ListItem key="logout" disablePadding>
          <ListItemButton onClick={logout}>
            <ListItemIcon>
              <LogoutIcon />
            </ListItemIcon>
            <ListItemText primary={t("logout")} />
          </ListItemButton>
        </ListItem>)}
      </List>
    </Box>
  );

  return (
    <Drawer anchor="right" disableEnforceFocus open={openDrawer} onClose={() => toggleDrawer(false)} sx={{zIndex: 1100}}>
      {list()}
    </Drawer>
  );
};
