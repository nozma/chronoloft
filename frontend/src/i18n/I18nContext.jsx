import { createContext, useContext, useEffect, useMemo } from 'react';
import { useSettings } from '../contexts/SettingsContext';
import { createTranslator, resolveLanguage } from './translate.js';

const I18nContext = createContext();

// 他の Context と同様に任意の子要素を受け取る。
// eslint-disable-next-line react/prop-types
export function I18nProvider({ children }) {
    const { language: savedLanguage } = useSettings();
    const language = resolveLanguage(savedLanguage);
    const value = useMemo(() => ({ language, t: createTranslator(language) }), [language]);

    useEffect(() => {
        document.documentElement.lang = language;
    }, [language]);

    return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
    return useContext(I18nContext);
}
