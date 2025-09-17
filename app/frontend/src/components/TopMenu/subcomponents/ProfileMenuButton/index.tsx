import * as React from "react";
import Menu from "@mui/material/Menu";
import {
  Box,
  FormControlLabel,
  ListItemIcon,
  ListItemText,
  MenuItem,
  Radio,
  RadioGroup,
  Switch,
} from "@mui/material";
import { UserProfilePicture } from "./ProfilePicture";
import { useTranslation } from "react-i18next";
import LanguageIcon from "@mui/icons-material/Language";
import SettingsIcon from "@mui/icons-material/Settings";
import { useAppStore } from "../../../../stores/AppStore";
import { allowedToolsSet } from "../../../../allowedTools";
import { useIsAuthenticated } from "@azure/msal-react";
import LogoutIcon from "@mui/icons-material/Logout";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import MenuDivider from "./MenuDivider";
import { tt } from "../../../../i18n/tt";
import { MUTUALLY_EXCLUSIVE_TOOLS } from "../../../../constants";
import { SettingsModal } from "../../../SettingsModal";

interface ProfilePictureOnClickMenuProps {
  size?: string;
  fontSize?: string;
  enabledTools: Record<string, boolean>;
  handleUpdateEnabledTools: (name: string) => void;
  selectedModel: string;
  handleSelectedModelChanged: (modelName: string) => void;
  logout: () => void;
}

export const ProfileMenuButton: React.FC<ProfilePictureOnClickMenuProps> = ({
  size,
  fontSize,
  enabledTools,
  handleUpdateEnabledTools,
  selectedModel,
  handleSelectedModelChanged,
  logout,
}) => {
  const isAuthenticated = useIsAuthenticated();
  const { t } = useTranslation();
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
  const appStore = useAppStore();

  const tools = Object.keys(enabledTools)
    .sort((a, b) => a.localeCompare(b))
    // Only show the tools that are enabled and in the allowedToolsSet
    .filter((tool) => allowedToolsSet.has(tool))
    //Don't mutually exclusive tools
    .filter((tool) => !MUTUALLY_EXCLUSIVE_TOOLS.includes(tool));

  const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleSelectedModelChanged((event.target as HTMLInputElement).value);
  };

  return (
    <>
      <Box
        id="profile-menu-button"
        sx={{
          cursor: "pointer",
        }}
        onClick={handleOpen}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            handleOpen(event);
          }
        }}
        tabIndex={0}
        title={tt("profile.icon.title")}
        aria-label={tt("profile.icon.title")}
        role="button"
        aria-haspopup="true"
        aria-expanded={isOpen ? "true" : undefined}
      >
        <Box
          id="profile-menu-inner-button"
          aria-controls={isOpen ? "profile-menu-menu" : undefined}
          aria-haspopup="true"
          aria-expanded={isOpen ? "true" : undefined}
          sx={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <MoreHorizIcon />
          <UserProfilePicture size={size} fontSize={fontSize} />
        </Box>
      </Box>
      <Menu
        id="profile-menu"
        aria-labelledby="profile-menu-button"
        anchorEl={anchorEl}
        open={isOpen}
        onClose={handleClose}
        anchorOrigin={{
          vertical: "bottom",
          horizontal: "left",
        }}
        transformOrigin={{
          vertical: "top",
          horizontal: "left",
        }}
        sx={{
          top: 5,
        }}
      // autoFocus
      >
        <MenuDivider title={tt("langlink.divider.description")} />
        <MenuItem
          id={`switch-lang-menu-item`}
          key="language-link"
          title={tt("langlink.divider.description")}
          onClick={() => {
            appStore.languageService.changeLanguage();
          }}
        >
          <ListItemIcon>
            <LanguageIcon fontSize="small" />
          </ListItemIcon>
          <ListItemText>{t("langlink")}</ListItemText>
        </MenuItem>
        <MenuDivider title={tt("menu.chooseTools")} />
        {tools.map((tool) => {
          return (
            <React.Fragment key={tool}>
              <MenuItem
                id={`tool-menu-item-${tool}`}
                key={tool}
                onClick={() => {
                  handleUpdateEnabledTools(tool);
                }}
              >
                <FormControlLabel
                  id={`tool-menu-item-form-${tool}`}
                  label={t(tool)}
                  role="menuitem"
                  aria-label={t(tool)}
                  title={t(tool)}
                  checked={enabledTools[tool]}
                  name={tool}
                  control={
                    <Switch
                      id={`tool-menu-item-switch-${tool}`}
                      onClick={(e) => {
                        // Without these onClick handlers, we get dead spaces on the MenuItem, where
                        // clicking in a specific spot does not toggle the switch.
                        e.stopPropagation();
                        // In this particular case, we want to handle the click event on the switch itself, since
                        // the MenuItem will never be called due to stopPropagation.
                        handleUpdateEnabledTools(tool);
                      }}
                    />
                  }
                  onClick={(e) => {
                    // Without these onClick handlers, we get dead spaces on the MenuItem, where
                    // clicking in a specific spot does not toggle the switch.
                    e.stopPropagation();
                  }}
                  slotProps={{
                    typography: {
                      onClick: (e) => {
                        // Without these onClick handlers, we get dead spaces on the MenuItem, where
                        // clicking in a specific spot does not toggle the switch.
                        e.stopPropagation();
                      },
                    },
                  }}
                />
              </MenuItem>
            </React.Fragment>
          );
        })}
        <MenuDivider title={t("menu.model.select")} />
        <MenuItem title={tt("menu.model.select")} key="select-language-model">
          <RadioGroup
            defaultValue="gpt-4o"
            aria-labelledby="select-language-model-radio"
            name="model-radios"
            value={selectedModel}
            onChange={handleRadioChange}
          >
            <FormControlLabel
              disabled
              value="gpt-4o"
              control={<Radio />}
              label="GPT-4o"
            />
          </RadioGroup>
        </MenuItem>
        {isAuthenticated && (
          <>
            <MenuDivider />
            <MenuItem
              id="settings-menu-item"
              title={tt("settings")}
              onClick={handleSettingsOpen}
              key="settings"
            >
              <ListItemIcon>
                <SettingsIcon color="disabled" fontSize="small" />
              </ListItemIcon>
              <ListItemText primary={tt("settings")} />
            </MenuItem>
            <MenuItem id="logout-menu-item" title={tt("logout")} onClick={logout} key="logout">
              <ListItemIcon>
                <LogoutIcon color="disabled" fontSize="small"></LogoutIcon>
              </ListItemIcon>
              <ListItemText primary={tt("logout")} />
            </MenuItem>
          </>
        )}
      </Menu>

      <SettingsModal open={isSettingsOpen} onClose={handleSettingsClose} />
    </>
  );
};
