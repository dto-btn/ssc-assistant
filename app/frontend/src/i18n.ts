import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import translations from './i18n/locales/translations.json';
import pgTrans from "./playground/locales/translations.json";

import Cookies from "js-cookie";

interface TranslationData {
  [key: string]: {
    en: string;
    fr: string;
  };
}

const extractLanguageData = (mergedData: TranslationData, language: keyof TranslationData[keyof TranslationData]): { [key: string]: string } => {
  const languageData: { [key: string]: string } = {};
  for (const [key, translations] of Object.entries(mergedData)) {
    languageData[key] = translations[language] || 'MISSING';
  }
  return languageData;
};

// Extract English and French translations
const enTranslations = extractLanguageData(translations, 'en');
const frTranslations = extractLanguageData(translations, 'fr');

const enPGT = extractLanguageData(pgTrans, 'en');
const frPGT = extractLanguageData(pgTrans, 'fr');


i18n.use(initReactI18next).init({
  fallbackLng: 'en',
  lng: Cookies.get("lang_setting"),
  resources: {
    en: {
      translations: enTranslations,
      playground: enPGT
    },
    fr: {
      translations: frTranslations,
      playground: frPGT
    }
  },
  ns: ['translations', 'playground'],
  defaultNS: 'translations',
  interpolation: {
    escapeValue: false // react already safes from xss
  }
});

i18n.languages = ['en', 'fr'];

export default i18n;