import React from 'react';  
import { useTranslation } from 'react-i18next';
import { SpeedDial, SpeedDialAction, SpeedDialIcon, Box } from '@mui/material';  
import DeleteIcon from '@mui/icons-material/Delete';  
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
  
interface DialProps {  
  onClearChat: () => void;
  onCopy: () => void;
}  
  
export const Dial = ({ onClearChat, onCopy }: DialProps) => {  
  const [open, setOpen] = React.useState(false);  
  const { t } = useTranslation();
  const handleClose = () => {  
    setOpen(false);  
  };  
  
  const handleOpen = () => {  
    setOpen(true);  
  };  
  
  const actions = [  
    { icon: <DeleteIcon />, name: t('clearchat'), handler: onClearChat },  
    { icon: <ContentCopyIcon />, name: t('copytext'), handler: onCopy },  
  ];  
  
  return (  
    <Box style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 2000 }} sx={{ display: { xs: 'none', sm: 'block' } }}>  
      <SpeedDial  
        ariaLabel="SpeedDial"  
        sx={{ position: 'absolute', bottom: 2, right: 2 }}  
        icon={<SpeedDialIcon />}  
        onClose={handleClose}  
        onOpen={handleOpen}  
        open={open}  
      >  
        {actions.map((action) => (  
          <SpeedDialAction  
            key={action.name}  
            icon={action.icon}  
            tooltipTitle={action.name}  
            onClick={action.handler}  
          />  
        ))}  
      </SpeedDial>  
    </Box>
  );
};  