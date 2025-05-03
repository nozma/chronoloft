import React, { createContext, useContext, useMemo } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';

const SettingsContext = createContext();

/**
 * SettingsProvider
 *   - autoFilterOnSelect: bool
 *   - setAutoFilterOnSelect: (bool) => void
 */
export function SettingsProvider({ children }) {
    // アクティビティ選択時に自動でアクティビティフィルタを切り替えるかどうかの設定
    const [autoFilterOnSelect, setAutoFilterOnSelect] =
        useLocalStorageState('settings.autoFilterOnSelect', true);
    // カラーテーマ設定
    const [themeMode, setThemeMode] =
        useLocalStorageState('settings.themeMode', 'system');
    // 最近使用した項目として表示するアクティビティを決める日数のしきい値
    const [recentDays, setRecentDays] =
        useLocalStorageState('settings.recentDays', '14');
    // 最近使用した項目として表示するアクティビティの件数の上限
    const [recentLimit, setRecentLimit] =
        useLocalStorageState('settings.recentLimit', '15');

    const value = useMemo(
        () => ({
            autoFilterOnSelect,
            setAutoFilterOnSelect,
            recentDays, setRecentDays,
            recentLimit, setRecentLimit,
            themeMode,
            setThemeMode,
        }),
        [autoFilterOnSelect, themeMode, recentDays, recentLimit]
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
