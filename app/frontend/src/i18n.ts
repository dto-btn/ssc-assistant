import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import en from './i18n/locales/en.json';
import fr from './i18n/locales/fr.json';

import Cookies from "js-cookie";

i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: Cookies.get("lang_setting"),
  resources: {
    en: {
      translations: en
    },
    fr: {
      translations: fr
    }
  },
  ns: ['translations'],
  defaultNS: 'translations',
  interpolation: {
    escapeValue: false // react already safes from xss
  }
});

i18n.languages = ['en', 'fr'];

export default i18n;