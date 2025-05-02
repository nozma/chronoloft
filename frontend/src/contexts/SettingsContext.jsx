import React, { createContext, useContext, useMemo } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';

const SettingsContext = createContext();

/**
 * SettingsProvider
 *   - autoFilterOnSelect: bool
 *   - setAutoFilterOnSelect: (bool) => void
 */
export function SettingsProvider({ children }) {
    const [autoFilterOnSelect, setAutoFilterOnSelect] =
        useLocalStorageState('settings.autoFilterOnSelect', true);
    const [themeMode, setThemeMode] =
        useLocalStorageState('settings.themeMode', 'system');

    const value = useMemo(
        () => ({
            autoFilterOnSelect,
            setAutoFilterOnSelect,
            /* ★ 追加 ↓ */
            themeMode,
            setThemeMode,
        }),
        [autoFilterOnSelect, themeMode]
    );

    return (
        <SettingsContext.Provider value={value}>
            {children}
        </SettingsContext.Provider>
    );
}

export function useSettings() {
    return useContext(SettingsContext);
}
