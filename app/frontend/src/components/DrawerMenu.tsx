import LanguageIcon from "@mui/icons-material/Language";
import DeleteIcon from '@mui/icons-material/Delete';
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
import { changeLanguage, t } from "i18next";
import LogoutIcon from '@mui/icons-material/Logout';
import { useIsAuthenticated } from "@azure/msal-react";
import Handyman from "@mui/icons-material/Handyman";
import { useState } from "react";
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'

interface DrawerMenuProps {
  openDrawer: boolean;
  toggleDrawer: (arg: boolean) => void;
  onClearChat: () => void;
  setLangCookie: () => void;
  logout: () => void;
  enabledTools: Record<string, boolean>;
  handleUpdateEnabledTools: (event: React.ChangeEvent<HTMLInputElement>) => void;
}

export const DrawerMenu = ({openDrawer, toggleDrawer, onClearChat, setLangCookie, 
  logout, enabledTools, handleUpdateEnabledTools} : DrawerMenuProps) => {
  const isAuthenticated = useIsAuthenticated();
  const [toolMenuOpen, setToolMenuOpen] = useState(false);

  const toggleToolDrawerOpen = () => {
    setToolMenuOpen(!toolMenuOpen);
  }

  const list = () => (
    <Box role="presentation" sx={{ width: 250 }}>
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
          <ListItemButton onClick={toggleToolDrawerOpen}>
            <ListItemIcon>
              <Handyman />
            </ListItemIcon>
            <ListItemText primary={t("menu.enableTools")}/>
            {toolMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </ListItemButton>
        </ListItem>
        <Collapse in={toolMenuOpen} timeout="auto" unmountOnExit>
          <Divider />
          <FormGroup>
            {Object.keys(enabledTools).map((tool) => {
              return (
                <FormControlLabel 
                  label={t(tool)} 
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
      </List>
      <Divider />
      <List>
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
