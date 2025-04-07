import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Box, ListItem, ListItemButton, ListItemIcon, ListItemText, Typography } from '@mui/material';
import { UserProfilePicture } from './ProfileMenuButton/ProfilePicture';
import { useContext } from 'react';
import { UserContext } from '../../../context/UserContext';
import { t, changeLanguage } from "i18next";
import AddCommentIcon from "@mui/icons-material/AddComment";
import LanguageIcon from "@mui/icons-material/Language";

interface ProfilePictureOnClickMenuProps {
    size?: string;
    fontSize?: string;
    setLangCookie: () => void;
    onNewChat: () => void;
}


export const ProfileMenuButton: React.FC<ProfilePictureOnClickMenuProps> = ({
    size,
    fontSize,
    setLangCookie,
    onNewChat
}) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const { graphData } = useContext(UserContext);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
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
                    gap: "1rem"
                }}
                onClick={handleClick}

            >
                <Typography
                    variant="body1"
                    sx={{ display: { xs: "none", lg: "block" } }}
                >
                    {graphData["givenName"]} {graphData["surname"]}
                </Typography>
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
                <ListItem key="newChat" disablePadding>
                    <ListItemButton onClick={() => onNewChat()}>
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
            </Menu>
        </Box>
    );
}