// todo: remove archibus
// todo: remove corporate.data

import Box from '@mui/material/Box';
import Switch from '@mui/material/Switch';
import FormGroup from '@mui/material/FormGroup';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Typography from '@mui/material/Typography';
import ContentCopy from '@mui/icons-material/ContentCopy';
import ContentPaste from '@mui/icons-material/ContentPaste';
import Cloud from '@mui/icons-material/Cloud';
import LanguageIcon from "@mui/icons-material/Language";
import FormControlLabel from '@mui/material/FormControlLabel';
import FormLabel from '@mui/material/FormLabel';
import ListItemButton from '@mui/material/ListItemButton';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import { useContext, useState } from 'react';
import { t } from 'i18next';
import MenuDivider from './MenuDivider';
import { tt } from '../../i18n/tt';
import { allowedToolsSet, allowedCorporateFunctionsSet } from "../../allowedTools";
import { useIsAuthenticated } from '@azure/msal-react';
import React from 'react';
import { UserContext } from '../../stores/UserContext';
import { useAppStore } from '../../stores/AppStore';
import LogoutIcon from '@mui/icons-material/Logout';

type Props = {

}

const NestedMenuPrototype: React.FC<Props> = ({ }) => {
    const isAuthenticated = useIsAuthenticated();
    const { graphData } = useContext(UserContext);
    const appStore = useAppStore();

    const handleSetSelectedCorporateFunction = () => {
        // todo
    }
    const selectedCorporateFunction = () => {
        // todo
    }
    const handleUpdateEnabledTools = () => {
        // todo
    }

    const { enabledTools } = appStore.tools;

    const tools = Object.keys(enabledTools).filter((tool) =>
        allowedToolsSet.has(tool)
    );

    const logout = () => {

    }

    const corporateKey = tools.find(i => i === "corporate") || null;

    return (
        <Paper sx={{ width: 320, maxWidth: '100%' }}>
            <MenuList>
                <MenuDivider title={t("langlink.divider.description")} />
                <MenuItem>
                    <ListItemIcon>
                        <LanguageIcon fontSize="small" />
                    </ListItemIcon>
                    <ListItemText>{t("langlink")}</ListItemText>
                </MenuItem>
                {/* <MenuItem>
                    <RadioGroup
                        aria-labelledby="demo-radio-buttons-group-label"
                        defaultValue="female"
                        name="radio-buttons-group"
                    >
                        <FormControlLabel value="female" control={<Radio />} label="Female" />
                        <FormControlLabel value="male" control={<Radio />} label="Male" />
                        <FormControlLabel value="other" control={<Radio />} label="Other" />
                    </RadioGroup>
                </MenuItem> */}
                {/* <MenuDivider title={tt("corporate.data")} />
                <MenuItem>

                    {corporateKey && (
                        <>
                            <FormGroup role="menu">
                                <RadioGroup
                                    aria-labelledby="corpo-data-label"
                                    name="corpo-data-group"
                                    onChange={handleSetSelectedCorporateFunction}
                                    value={selectedCorporateFunction}
                                    defaultValue="intranet_question"
                                    role="group"
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
                                                role="menuitem"
                                                title={t(name)}
                                                aria-label={t(name)}
                                            />
                                        )
                                    )}
                                </RadioGroup>
                            </FormGroup>
                            <MenuItem>
                            </MenuItem>
                        </>
                    )}
                </MenuItem> */}
                <MenuDivider title={tt("menu.chooseTools")} />
                <MenuItem>
                    <FormGroup>
                        {tools.map((tool, index) => {
                            return (
                                <FormControlLabel
                                    label={t(tool)}
                                    key={index}
                                    role="menuitem"
                                    aria-label={t(tool)}
                                    title={t(tool)}
                                    control={
                                        <Switch
                                            checked={enabledTools[tool]}
                                            onChange={handleUpdateEnabledTools}
                                            name={tool}
                                        />
                                    }
                                />
                            );
                        })}
                    </FormGroup>
                </MenuItem>
                {isAuthenticated && (
                    <>
                        <MenuDivider />
                        <MenuItem>
                            <ListItemButton onClick={logout}>
                                <ListItemIcon>
                                    <LogoutIcon />
                                </ListItemIcon>
                                <ListItemText primary={t("logout")} />
                            </ListItemButton>
                        </MenuItem>
                    </>
                )}
            </MenuList>
        </Paper>
    );
}

export default NestedMenuPrototype