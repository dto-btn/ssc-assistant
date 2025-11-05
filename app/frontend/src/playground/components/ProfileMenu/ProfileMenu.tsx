import * as React from "react";
import { RootState } from '../../store';
import { useTranslation } from 'react-i18next';
import { useSelector } from "react-redux";
import {
  Box,
  Button,
  Collapse,
  ListItemIcon,
  ListItemText,
  MenuItem,
} from "@mui/material";
import Menu from "@mui/material/Menu";
import { UserProfilePicture } from "./ProfilePicture";
import MenuDivider from "./MenuDivider";
import LogoutIcon from "@mui/icons-material/Logout";
import SettingsIcon from "@mui/icons-material/Settings";
import { PROFILE_MENU_WIDTH } from "../../constants";
import { DevBanner } from "../DevBanner";


/**
 * Prop for {@link ProfileMenu}
 * 
 * @property size - size of profile picture avatar
 * @property fontsize - Font size for the letters used to generate avatar in the event profile picture not found.
 * @property logout - logout action
 */
interface ProfileMenuProps {
  size?: string;
  fontSize?: string;
  logout: () => void;
}

/**
 * ProfileMenu Component
 * 
 * Component holding menu items related to user profile menu. 
 * Currently resides at the bottom of sidebar
 * Settings, Logout, etc.
 */
const ProfileMenu: React.FC<ProfileMenuProps> = ({
  size,
  fontSize,
  logout,
}) => {

  const isAuthenticated = useSelector((state: RootState) => state.auth.isAuthenticated);
  const { t } = useTranslation('playground');
  const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const handleOpen = (
    event: React.MouseEvent<HTMLElement> | React.KeyboardEvent<HTMLElement>
  ) => {
    setAnchorEl(event.currentTarget);
    setIsOpen(true);
  };
  const handleClose = () => {
    setAnchorEl(null);
    setIsOpen(false);
  };
  const handleSettingsOpen = () => {
    setIsSettingsOpen(true);
    handleClose(); // Close the profile menu when opening settings
  };
  const handleSettingsClose = () => {
    setIsSettingsOpen(false);
  };
  
  return (
    <><Button
        id="profile-menu-button"
        sx={{
          cursor: "pointer",
          width: 1
        }}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleOpen(event);
          }
        }}
        tabIndex={0}
        title={t("profile.icon.title")}
        aria-label={t("profile.icon.title")}
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen ? "true" : undefined}
      >
          <UserProfilePicture size={size} fontSize={fontSize} />
          <DevBanner />
          <Box //floats the avatar and name to left
            sx={{
              marginLeft: "auto",
              display: "flex",
              gap: "1rem",
            }}
          ></Box>
      </Button>
      <Menu
        id="profile-menu"
        aria-labelledby="profile-menu-button"
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        slots={{ transition: Collapse }}
        sx={{
          top: 5,
        }}
        slotProps={{ paper: { sx: { width: PROFILE_MENU_WIDTH } } }}
      // autoFocus
      >      
  
        {isAuthenticated && (
          <>
            <MenuDivider title={t("profile.settings")}/>
            <MenuItem
              id="settings-menu-item"
              title={t("profile.settings")}
              onClick={handleSettingsOpen}
              key="profile.settings"
            >
              <ListItemIcon>
                <SettingsIcon color="disabled" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={t("profile.settings")} />
            </MenuItem>
            <MenuDivider title={t("profile.logout")} />
            <MenuItem id="logout-menu-item" title={t("profile.logout")} onClick={logout} key="profile.logout">
              <ListItemIcon>
                <LogoutIcon color="disabled" fontSize="small"></LogoutIcon>
              </ListItemIcon>
              <ListItemText primary={t("profile.logout")} />
            </MenuItem>
          </>
        )}
      </Menu>
    </>
  )
}

export default ProfileMenu;