import { useState } from 'react';  
import { Dialog, DialogTitle, DialogContent, DialogActions, Button } from '@mui/material';  
import { useTranslation } from 'react-i18next';  
  
import Cookies from "js-cookie";  
  
export const Disclaimer = () => {  
    const { t, i18n } = useTranslation();  
  
    const setTranslationCookie = () => {  
        Cookies.set("lang_setting", i18n.language, {  
            expires: 30,  
        });  
    };  
  
    const changeLanguage = (lng: string) => {  
        i18n.changeLanguage(lng);  
    };  
  
    const [hideDialog, setHideDialog] = useState(false);  
  
    return (  
        <div>  
            <Dialog open={!hideDialog} onClose={() => setHideDialog(true)} fullWidth>  
                <DialogTitle>{t("disclaimer")}</DialogTitle>  
                <DialogContent>  
                    <p>{t("disclaimer.desc")}</p>  
                    <p style={{ fontWeight: "bold" }}>{t("disclaimer.desc2")}</p>  
                </DialogContent>  
                <DialogActions>  
                    <Button style={{ backgroundColor: "#4b3e99", color: "white"}}onClick={() => { setHideDialog(true); }}>{t("close")}</Button>  
                    <Button onClick={() => { changeLanguage(t("langlink.shorthand")); setTranslationCookie(); }}>{t("langlink")}</Button>  
                </DialogActions>  
            </Dialog>  
        </div>  
    );  
};  
