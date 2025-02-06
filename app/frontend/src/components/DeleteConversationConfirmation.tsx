import { t } from "i18next";
import React from "react";
import { Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, styled } from "@mui/material";

type Props = {
    open: boolean;
    onClose: () => void;
    onDelete: () => void;
}
export const DeleteConversationConfirmation: React.FC<Props> = ({
    open,
    onClose,
    onDelete,
}) => {
    return (
        <Dialog
            open={open}
            onClose={onClose}
        >
            <DialogTitle>{t("delete.conversation.title")}</DialogTitle>
            <DialogContent>
                <DialogContentText>
                    {t("delete.conversation.content")}
                </DialogContentText>
            </DialogContent>
            <DialogActions sx={{ display: 'flex', justifyContent: 'flex-start' }}>
                <CancelButton onClick={onClose} >
                    {t("cancel")}
                </CancelButton>
                <DeleteButton onClick={onDelete}>
                    {t("delete")}
                </DeleteButton>
            </DialogActions>
        </Dialog>
    );
};


const CancelButton = styled(Button)(({ theme }) => ({
    backgroundColor: theme.palette.primary.main,
    color: 'white',
    width: '100px',
    margin: '5px 15px',
}));

const DeleteButton = styled(Button)(() => ({
    backgroundColor: '#C43831',
    color: 'white',
    width: '100px',
}));