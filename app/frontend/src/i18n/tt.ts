import { t } from 'i18next';
export type TranslationKeys = keyof typeof import('./locales/translations.json');

/**
 * Typesafe translation function.
 * @param key - The key of the translation string
 * @returns 
 */
export const tt = (key: TranslationKeys) => {
    return t(key);
}