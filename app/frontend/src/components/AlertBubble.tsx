import Alert from '@mui/material/Alert';
import { Box } from '@mui/material';
import {styled} from '@mui/system';
import { visuallyHidden } from '@mui/utils';
import { t } from 'i18next';


interface AlterBubbleProps {
    toast: ToastMessage;
    index: number;
    removeMessageHandler: (index: number) => void;
}

export const AlertBubble = ({ toast, index, removeMessageHandler }: AlterBubbleProps) => {
    const alertSeverity = toast.isError ? "error" : "success";

    const handleCloseClicked = () => {
        removeMessageHandler(index);
    }

    return (
        <AlertView tabIndex={0}>
            <Box sx={visuallyHidden}>{t("aria.alert.message")}</Box> {/* Hidden div for screen reader */}
            <Alert 
                severity={alertSeverity} 
                style={{ width: '70%', borderRadius: '20px' }} 
                elevation={4}
                onClose={() => {handleCloseClicked()}}
            >
                {toast.toastMessage}
            </Alert>
        </AlertView>
    )

}

const AlertView = styled(Box)`
    margin: 30px 0px;
    display: flex;
    justify-content: center;
`;