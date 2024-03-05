import React from 'react';  
import { SpeedDial, SpeedDialAction, SpeedDialIcon, useMediaQuery, useTheme } from '@mui/material';  
import DeleteIcon from '@mui/icons-material/Delete';  
  
interface DialProps {  
  onClearChat: () => void;
}  
  
export const Dial = ({ onClearChat}: DialProps) => {  
  const [open, setOpen] = React.useState(false);  
  const theme = useTheme();
  const matches = useMediaQuery(theme.breakpoints.up('sm')); // check if screen is small
  
  const handleClose = () => {  
    setOpen(false);  
  };  
  
  const handleOpen = () => {  
    setOpen(true);  
  };  
  
  const actions = [  
    { icon: <DeleteIcon />, name: 'Clear Chat', handler: onClearChat },  
  ];  
  
  return (    
    <div style={{ position: 'fixed', bottom: matches ? '16px' : 'unset', top: matches ? 'unset' : '14px', right: '14px', zIndex: 2000 }}>    
      <SpeedDial    
        ariaLabel="SpeedDial"    
        sx={{ position: 'absolute', bottom: matches ? 2 : 'unset', top: matches ? 'unset' : 2, right: 2 }}    
        icon={<SpeedDialIcon />}    
        onClose={handleClose}    
        onOpen={handleOpen}    
        open={open}    
        direction={matches ? 'up' : 'down'}
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
    </div>    
  );  
};  