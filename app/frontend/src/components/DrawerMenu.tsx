import LanguageIcon from "@mui/icons-material/Language";
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Divider,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import { changeLanguage, t } from "i18next";
import LogoutIcon from '@mui/icons-material/Logout';
import { useIsAuthenticated } from "@azure/msal-react";

interface DrawerMenuProps {
  openDrawer: boolean;
  toggleDrawer: (arg: boolean) => void;
  onClearChat: () => void;
  setLangCookie: () => void;
  logout: () => void;
}

export const DrawerMenu = ({openDrawer, toggleDrawer, onClearChat, setLangCookie, logout} : DrawerMenuProps) => {
  const isAuthenticated = useIsAuthenticated();

  const list = () => (
    <Box role="presentation" onClick={() => toggleDrawer(false)} sx={{ width: 250 }}>
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
      </List>
      <Divider />
      <List>
        {!isAuthenticated &&
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
