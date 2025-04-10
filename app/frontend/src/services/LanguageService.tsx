import { t, changeLanguage } from "i18next";
import Cookies from "js-cookie";
import i18n from "../i18n";

export class LanguageService {
    changeLanguage() {
        changeLanguage(t("langlink.shorthand"));
        Cookies.set("lang_setting", this.getCurrentLanguageCode(), {
            expires: 30,
        });
    }

    getCurrentLanguageCode() {
        return i18n.language;
    }
}