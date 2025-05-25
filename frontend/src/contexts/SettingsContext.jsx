import React, { createContext, useContext, useMemo } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';

// ───────── 既定値定義（リセット用に公開する） ─────────
export const DEFAULT_SETTINGS = {
    autoFilterOnSelect: true,
    themeMode: 'system',
    recentDays: '14',
    recentLimit: '15',
    discordEnabled: true,
    recordSaveMode: 'auto',
};

const SettingsContext = createContext();

/**
 * SettingsProvider
 *   - autoFilterOnSelect: bool
 *   - setAutoFilterOnSelect: (bool) => void
 */
export function SettingsProvider({ children }) {
    // アクティビティ選択時に自動でアクティビティフィルタを切り替えるかどうかの設定
    const [autoFilterOnSelect, setAutoFilterOnSelect] =
        useLocalStorageState('settings.autoFilterOnSelect', DEFAULT_SETTINGS.autoFilterOnSelect);
    // カラーテーマ設定
    const [themeMode, setThemeMode] =
        useLocalStorageState('settings.themeMode', DEFAULT_SETTINGS.themeMode);
    // 最近使用した項目として表示するアクティビティを決める日数のしきい値
    const [recentDays, setRecentDays] =
        useLocalStorageState('settings.recentDays', DEFAULT_SETTINGS.recentDays);
    // 最近使用した項目として表示するアクティビティの件数の上限
    const [recentLimit, setRecentLimit] =
        useLocalStorageState('settings.recentLimit', DEFAULT_SETTINGS.recentLimit);
    // ★ Discord 連係の有効/無効（既定: 有効）
    const [discordEnabled, setDiscordEnabled] =
        useLocalStorageState('settings.discordEnabled', DEFAULT_SETTINGS.discordEnabled);
    // ★ レコード保存モード
    const [recordSaveMode, setRecordSaveMode] =
        useLocalStorageState('settings.recordSaveMode', DEFAULT_SETTINGS.recordSaveMode);


    const value = useMemo(
        () => ({
            autoFilterOnSelect,
            themeMode, setThemeMode,
            setAutoFilterOnSelect,
            recentDays, setRecentDays,
            recentLimit, setRecentLimit,
            discordEnabled, setDiscordEnabled,
            recordSaveMode, setRecordSaveMode,
        }),
        [autoFilterOnSelect, themeMode, recentDays, recentLimit, discordEnabled, recordSaveMode]
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
