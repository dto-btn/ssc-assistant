import React from 'react';
import { useMsal } from "@azure/msal-react";
import { userRead } from "../authConfig";
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { useAppStore } from '../context/AppStore';
import { useTranslation } from 'react-i18next';

const logoStyle = {
  width: "50px",
  height: "auto",
};

const LoginPage = ({ open, setOpen }: { open: boolean, setOpen: React.Dispatch<React.SetStateAction<boolean>> }) => {
  const { t } = useTranslation();
  const { instance } = useMsal();
  const appStore = useAppStore();

  const handleLogin = () => {
    instance.loginPopup(userRead).then((response) => {
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
          height: 280,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          outline: 'none',
        }}
      >
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={logo} style={logoStyle} alt="logo of SSC" />
          <Button onClick={() => { appStore.languageService.changeLanguage() }}>{t("langlink")}</Button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <h2 style={{ marginBottom: '1rem' }}>{t("welcome")}</h2>
          <h3 style={{ marginTop: '1rem' }}>{t("login.required")}</h3>
          <Button size="large" style={{ backgroundColor: "#4b3e99", color: "white" }} onClick={handleLogin}>{t("login")}</Button>
        </div>
      </Box>

    </Modal>
  );
};

export default LoginPage;

