import * as React from 'react';
import Menu from '@mui/material/Menu';
import { Box, Chip, Collapse, Divider, FormControlLabel, FormGroup, FormLabel, ListItem, ListItemButton, ListItemIcon, ListItemText, Radio, RadioGroup, Switch } from '@mui/material';
import { UserProfilePicture } from './ProfilePicture';
import { useContext } from 'react';
import { UserContext } from '../../../../stores/UserContext';
import { useTranslation } from "react-i18next";
import LanguageIcon from "@mui/icons-material/Language";
import { useAppStore } from '../../../../stores/AppStore';
import HandymanIcon from '@mui/icons-material/Handyman';
import PsychologyIcon from "@mui/icons-material/Psychology";
import { allowedToolsSet, allowedCorporateFunctionsSet } from "../../../../allowedTools";
import ExpandLessIcon from "@mui/icons-material/ExpandLess";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { useIsAuthenticated } from '@azure/msal-react';
import LogoutIcon from "@mui/icons-material/Logout";
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';

interface ProfilePictureOnClickMenuProps {
    size?: string;
    fontSize?: string;
    enabledTools: Record<string, boolean>;
    handleSetSelectedCorporateFunction: (
        event: React.ChangeEvent<HTMLInputElement>
    ) => void;
    selectedCorporateFunction: string;
    handleUpdateEnabledTools: (
        event: React.ChangeEvent<HTMLInputElement>
    ) => void;
    selectedModel: string;
    handleSelectedModelChanged: (modelName: string) => void;
    logout: () => void;
}


export const ProfileMenuButton: React.FC<ProfilePictureOnClickMenuProps> = ({
    size,
    fontSize,
    enabledTools,
    handleSetSelectedCorporateFunction,
    selectedCorporateFunction,
    handleUpdateEnabledTools,
    selectedModel,
    handleSelectedModelChanged,
    logout
}) => {
    const isAuthenticated = useIsAuthenticated();
    const { t } = useTranslation();
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [toolsMenuOpen, setToolsMenuOpen] = React.useState(false);
    const [modelMenuOpen, setModelMenuOpen] = React.useState(false);
    const open = Boolean(anchorEl);
    const { graphData } = useContext(UserContext);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };
    const appStore = useAppStore();

    const tools = Object.keys(enabledTools).filter((tool) =>
        allowedToolsSet.has(tool)
    );
    // separate corporate key
    const corporateKeyIndex = tools.indexOf("corporate");
    const corporateKey =
        corporateKeyIndex > -1 ? tools.splice(corporateKeyIndex, 1)[0] : null;


    const handleRadioChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        handleSelectedModelChanged((event.target as HTMLInputElement).value);
    };

    return graphData && (
        <Box
            sx={{
                cursor: "pointer"
            }}
        >
            <Box
                id="demo-positioned-button"
                aria-controls={open ? 'demo-positioned-menu' : undefined}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                sx={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "center",
                    gap: "0.5rem"
                }}
                onClick={handleClick}

            >

                <MoreHorizIcon />
                <UserProfilePicture
                    fullName={graphData["givenName"] + " " + graphData["surname"]}
                    size={size}
                    fontSize={fontSize}
                />
            </Box>
            <Menu
                id="demo-positioned-menu"
                aria-labelledby="demo-positioned-button"
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
            >
                <ListItem key="language" disablePadding>
                    <ListItemButton
                        onClick={() => {
                            appStore.languageService.changeLanguage();
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
                <ListItem key="toolSettings" disablePadding >
                    <ListItemButton
                        onClick={() => setToolsMenuOpen(!toolsMenuOpen)}
                        aria-expanded={true}
                    >
                        <ListItemIcon>
                            <HandymanIcon />
                        </ListItemIcon>
                        <ListItemText primary={t("menu.chooseTools")} />
                        {toolsMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                </ListItem>
                <Collapse in={toolsMenuOpen} timeout="auto" unmountOnExit >
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
                <ListItem key="modelSelection" disablePadding >
                    <ListItemButton
                        aria-expanded={true}
                        onClick={() => setModelMenuOpen(!modelMenuOpen)}
                    >
                        <ListItemIcon>
                            <PsychologyIcon />
                        </ListItemIcon>
                        <ListItemText>{t("model.version.select")}</ListItemText>
                        {modelMenuOpen ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </ListItemButton>
                </ListItem>
                <Collapse in={modelMenuOpen} timeout="auto" unmountOnExit>
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
            </Menu>
        </Box>
    );
}