import React from 'react';  
import { useMsal } from "@azure/msal-react";  
import { loginRequest } from "../authConfig";  
import Modal from '@mui/material/Modal';  
import Button from '@mui/material/Button';  
import Box from '@mui/material/Box';  
  
const LoginPage = ({ open, setOpen }: { open: boolean, setOpen: React.Dispatch<React.SetStateAction<boolean>> }) => {
  const { instance } = useMsal();  
  
  const handleLogin = () => {  
    instance.loginPopup(loginRequest).then((response) => {  
      if (response) {  
        setOpen(false);  
      }  
    }).catch((e) => {  
      console.error(e);  
    });  
  };  
  
  return (  
    <Modal open={open}>  
      <Box  
        sx={{  
          position: 'absolute',  
          top: '50%',  
          left: '50%',  
          transform: 'translate(-50%, -50%)',  
          width: 600,  
          height: 250,  
          bgcolor: 'background.paper',  
          boxShadow: 24,  
          p: 4,  
          display: 'flex',  
          flexDirection: 'column',  
          alignItems: 'center',  
          justifyContent: 'center',  
        }}  
      >  
        <h1>Login Required to Proceed</h1>  
        <Button style={{ backgroundColor: "#4b3e99", color: "white", fontSize: '1rem', padding: '1rem 2rem' }} onClick={handleLogin}>Login</Button>  
      </Box>  
  
    </Modal>  
  );  
};  
  
export default LoginPage;  
