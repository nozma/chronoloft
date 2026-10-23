import { resolveLanguage } from '../i18n/translate.js';
import { createContext, useContext, useMemo, useSyncExternalStore } from 'react';
import useMediaQuery from '@mui/material/useMediaQuery';
import { DEFAULT_SETTINGS, getSettingsSnapshot, saveSettings, subscribeSettings } from '../services/settings';

export { DEFAULT_SETTINGS };

const SettingsContext = createContext();

export function SettingsProvider({ children }) {
    const snapshot = useSyncExternalStore(subscribeSettings, getSettingsSnapshot);
    const isMobile = useMediaQuery('(max-width: 599.95px)');
    const value = useMemo(() => ({
        ...snapshot.settings,
        language: resolveLanguage(snapshot.settings.language),
        isMobile,
        isTwoColumnLayout: !isMobile && snapshot.settings.layoutMode === 'two-column',
        settingsError: snapshot.error,
        saveSettings,
    }), [snapshot, isMobile]);

    // Discord連携などが初期値で動き始める前に、起動PCの共通設定を読み込む。
    return <SettingsContext.Provider value={value}>
        {snapshot.ready ? children : <div style={{ padding: 32 }}>設定を読み込んでいます…</div>}
    </SettingsContext.Provider>;
}

export function useSettings() {
    return useContext(SettingsContext);
}
