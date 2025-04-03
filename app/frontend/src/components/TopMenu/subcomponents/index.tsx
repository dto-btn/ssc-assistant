import * as React from 'react';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { Box, Typography } from '@mui/material';
import { UserProfilePicture } from './ProfileMenuButton/ProfilePicture';
import { useContext } from 'react';
import { UserContext } from '../../../context/UserContext';

interface ProfilePictureOnClickMenuProps {
    size?: string;
    fontSize?: string;
}


export const ProfileMenuButton: React.FC<ProfilePictureOnClickMenuProps> = ({
    size,
    fontSize,
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
                    gap: "1rem",
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
                <MenuItem onClick={handleClose}>Profile</MenuItem>
                <MenuItem onClick={handleClose}>My account</MenuItem>
                <MenuItem onClick={handleClose}>Logout</MenuItem>
            </Menu>
        </Box>
    );
}