import React from 'react';
import { Chip, Divider } from '@mui/material';

interface MenuDividerProps {
    title?: string
}

const MenuDivider: React.FC<MenuDividerProps> = ({ title }) => {
    return (
        <Divider textAlign='left'>
            {title && (
                <Chip
                    label={title}
                    size="small"
                    sx={{ backgroundColor: "transparent" }}
                />
            )}
        </Divider>
    );
};

export default MenuDivider;