import { t } from 'i18next';
import { TranslationKeys } from './locales/translations.types';

// Typed Translations
export const tt = (key: TranslationKeys) => {
    return t(key);
}