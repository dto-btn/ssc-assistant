import { t, changeLanguage } from "i18next";
import i18n from "../i18n";

export class LanguageService {
    changeLanguage() {
        changeLanguage(t("langlink.shorthand"));
    }

    getCurrentLanguageCode() {
        return i18n.language;
    }
}