import React from 'react';  
import { SpeedDial, SpeedDialAction, SpeedDialIcon } from '@mui/material';  
import DeleteIcon from '@mui/icons-material/Delete';  
  
export interface DialProps {  
  onClearChat: () => void; // This function will be passed as a prop to handle the "Clear Chat" action.  
}  
  
export const Dial: React.FC<DialProps> = ({ onClearChat }) => {  
  const [open, setOpen] = React.useState(false);  
  
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
    <div style={{ position: 'fixed', bottom: '16px', right: '16px', zIndex: 2000 }}>  
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
    </div>  
  );  
};  