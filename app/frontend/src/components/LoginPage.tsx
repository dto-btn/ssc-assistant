import React from 'react';
import { useMsal } from "@azure/msal-react";
import { loginRequest } from "../authConfig";
import Modal from '@mui/material/Modal';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import logo from "../assets/SSC-Logo-Purple-Leaf-300x300.png";
import { changeLanguage, t } from "i18next";

const logoStyle = {
  width: "50px",
  height: "auto",
};

const LoginPage = ({ open, setOpen, setLangCookie }: { open: boolean, setOpen: React.Dispatch<React.SetStateAction<boolean>>, setLangCookie: () => void }) => {
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
          height: 280,
          bgcolor: 'background.paper',
          boxShadow: 24,
          p: 3,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
          <img src={logo} style={logoStyle} alt="logo of SSC" />
          <Button onClick={() => {changeLanguage(t("langlink.shorthand")); setLangCookie();}}>{t("langlink")}</Button>
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
