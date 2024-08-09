import LanguageIcon from "@mui/icons-material/Language";
import DeleteIcon from '@mui/icons-material/Delete';
import PsychologyIcon from '@mui/icons-material/Psychology';
import {
  Box,
  Collapse,
  Divider,
  Drawer,
  FormControlLabel,
  FormGroup,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Switch,
} from "@mui/material";
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { changeLanguage, t } from "i18next";
import LogoutIcon from '@mui/icons-material/Logout';
import { useIsAuthenticated } from "@azure/msal-react";
import Handyman from "@mui/icons-material/Handyman";
import { useEffect, useState } from "react";
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface DrawerMenuProps {
  openDrawer: boolean;
  toggleDrawer: (arg: boolean) => void;
  onClearChat: () => void;
  setLangCookie: () => void;
  logout: () => void;
  enabledTools: Record<string, boolean>;
  selectedModel: string;
  handleUpdateEnabledTools: (event: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectedModelChanged: (modelName: string) => void;
}

export const DrawerMenu = ({openDrawer, toggleDrawer, onClearChat, setLangCookie, 
  logout, enabledTools, handleUpdateEnabledTools, handleSelectedModelChanged, selectedModel} : DrawerMenuProps) => {
  const isAuthenticated = useIsAuthenticated();
  const [toolMenuOpen, setToolMenuOpen] = useState(false);
  const [selectModelMenuOpen, setSelectModelMenuOpen] = useState(false);

  const toggleToolDrawerOpen = () => {
    setToolMenuOpen(!toolMenuOpen);
  }

  const toggleSelectModelMenuOpen = () => {
    setSelectModelMenuOpen(!selectModelMenuOpen);
  }

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectedModelChanged((event.target as HTMLInputElement).value);
  };

  // use effect to close the collapses when the drawer is toggled closed
  useEffect(() => {
    if (!openDrawer) {
      setSelectModelMenuOpen(false);
      setToolMenuOpen(false);
    }
  }, [openDrawer]);


  const list = () => (
    <Box role="presentation" 
      sx={{ 
        width: 350,
        display: 'flex',
        flexDirection: 'column',
        height: '100vh'
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
        <ListItem key="clearchat" disablePadding>
          <ListItemButton onClick={onClearChat}>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText primary={t("clearchat")} />
          </ListItemButton>
        </ListItem>
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
      </List>
      <List sx={{marginTop: 'auto'}}>
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
    <Drawer anchor="right" open={openDrawer} onClose={() => toggleDrawer(false)}>
      {list()}
    </Drawer>
  );
};
