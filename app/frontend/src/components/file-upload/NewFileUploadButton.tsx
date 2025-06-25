import AttachFileIcon from "@mui/icons-material/AttachFile";
import DocumentScannerRounded from "@mui/icons-material/DocumentScannerRounded";
import {
    IconButton,
    Menu,
    MenuItem,
} from "@mui/material";
import { UploadFileButtonMenuItem } from "../file-upload/UploadFileButtonMenuItem";
import { StyledIconButton } from './StyledIconButton';
import React, { useState } from 'react';
import { tt } from '../../i18n/tt';

type NewFileUploadButtonProps = {
    onFileUpload: (file: Attachment) => void;
    disabled: boolean;
}

export const NewFileUploadButton: React.FC<NewFileUploadButtonProps> = ({ onFileUpload, disabled }) => {
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);

    const handleMenuClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleMenuClose = () => {
        setAnchorEl(null);
    };
    return (
        <>
            <IconButton
                aria-label="upload options"
                onClick={handleMenuClick}
                disabled={disabled}
                size="large"
            >
                <AttachFileIcon />
            </IconButton>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleMenuClose}
                style={{
                    // make it look sleeck and fit the content
                    maxWidth: "300px",
                    minWidth: "200px",
                }}
            >
                <UploadFileButtonMenuItem disabled={disabled} onFileUpload={onFileUpload} />
                <MenuItem>
                    <StyledIconButton>
                        <DocumentScannerRounded />
                    </StyledIconButton>
                    {tt("attach.document")}
                </MenuItem>
            </Menu>
        </>
    )
}