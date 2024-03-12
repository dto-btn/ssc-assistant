import LanguageIcon from "@mui/icons-material/Language";
import DeleteIcon from '@mui/icons-material/Delete';
import {
  Box,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText
} from "@mui/material";
import { changeLanguage, t } from "i18next";

interface DrawerMenuProps {
  openDrawer: boolean;
  toggleDrawer: (arg: boolean) => void;
  onClearChat: () => void;
  setLangCookie: () => void;
}

export const DrawerMenu = ({openDrawer, toggleDrawer, onClearChat, setLangCookie} : DrawerMenuProps) => {

  // Menu for mobile screens
  const list = () => (
    <Box role="presentation" onClick={() => toggleDrawer(false)} sx={{ width: 250 }}>
      <List>
        <ListItem key="language" disablePadding>
          <ListItemButton>
            <ListItemIcon>
              <LanguageIcon />
            </ListItemIcon>
            <ListItemText primary={t("langlink")} onClick={() => {
              changeLanguage(t("langlink.shorthand"));
              setLangCookie();
            }} />
          </ListItemButton>
        </ListItem>
        <ListItem key="clearchat" disablePadding>
          <ListItemButton>
            <ListItemIcon>
              <DeleteIcon />
            </ListItemIcon>
            <ListItemText primary={t("clearchat")}  onClick={onClearChat} />
          </ListItemButton>
        </ListItem>
      </List>
    </Box>
  );

  return (
    <Drawer anchor="right" open={openDrawer} onClose={() => toggleDrawer(false)}>
      {list()}
    </Drawer>
  );
};
