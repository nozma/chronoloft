import { useI18n } from '../i18n/I18nContext';
import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Switch,
    FormControl,
    FormLabel,
    Radio,
    RadioGroup,
    Stack,
    Divider,
    Box,
} from '@mui/material';
import { useSettings, DEFAULT_SETTINGS } from '../contexts/SettingsContext';

function SettingsDialog({ open, onClose }) {
    const { t } = useI18n();
    const {
        language: savedLanguage, setLanguage,
        autoFilterOnSelect, setAutoFilterOnSelect,
        themeMode, setThemeMode,
        layoutMode, setLayoutMode,
        recentDays, setRecentDays,
        recentLimit, setRecentLimit,
        discordEnabled, setDiscordEnabled,
        recordSaveMode, setRecordSaveMode,
    } = useSettings();

    // ─── 設定値のローカルコピー ───
    const [tmpLanguage, setTmpLanguage] = useState(savedLanguage);
    const [tmpAutoFilter, setTmpAutoFilter] = useState(autoFilterOnSelect);
    const [tmpThemeMode, setTmpThemeMode] = useState(themeMode);
    const [tmpLayoutMode, setTmpLayoutMode] = useState(layoutMode);
    const [tmpRecentDays, setTmpRecentDays] = useState(recentDays);
    const [tmpRecentLimit, setTmpRecentLimit] = useState(recentLimit);
    const [tmpDiscordEnabled, setTmpDiscordEnabled] = useState(discordEnabled);
    const [tmpRecordSaveMode, setTmpRecordSaveMode] = useState(recordSaveMode);
    // ダイアログを開くたびに最新値でリセット
    useEffect(() => {
        if (open) {
            setTmpLanguage(savedLanguage);
            setTmpAutoFilter(autoFilterOnSelect);
            setTmpThemeMode(themeMode);
            setTmpLayoutMode(layoutMode);
            setTmpRecentDays(recentDays);
            setTmpRecentLimit(recentLimit);
            setTmpDiscordEnabled(discordEnabled);
            setTmpRecordSaveMode(recordSaveMode);
        }
    }, [open, savedLanguage, autoFilterOnSelect, themeMode, layoutMode, recentDays, recentLimit, discordEnabled, recordSaveMode]);

    // リセット用ハンドラ
    const handleReset = () => {
        // 既定値を適用
        setTmpLanguage(DEFAULT_SETTINGS.language);
        setTmpAutoFilter(DEFAULT_SETTINGS.autoFilterOnSelect);
        setTmpThemeMode(DEFAULT_SETTINGS.themeMode);
        setTmpLayoutMode(DEFAULT_SETTINGS.layoutMode);
        setTmpRecentDays(DEFAULT_SETTINGS.recentDays);
        setTmpRecentLimit(DEFAULT_SETTINGS.recentLimit);
        setTmpDiscordEnabled(DEFAULT_SETTINGS.discordEnabled);
        setTmpRecordSaveMode(DEFAULT_SETTINGS.recordSaveMode);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm">
            <DialogTitle>{t("Settings")}</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={3} divider={<Divider flexItem />}>
                    <FormControl component="fieldset">
                        <FormLabel component="legend">{t("Language")}</FormLabel>
                        <RadioGroup row value={tmpLanguage} onChange={e => setTmpLanguage(e.target.value)}>
                            <FormControlLabel value="ja" label="日本語" control={<Radio />} />
                            <FormControlLabel value="en" label="English" control={<Radio />} />
                        </RadioGroup>
                    </FormControl>
                    {/* ------------- 外観関連設定 ------------- */}
                    <Stack spacing={3}>
                        {/* ダークモード・ライトモード切り替え */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Theme")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpThemeMode}
                                onChange={(e) => setTmpThemeMode(e.target.value)}
                            >
                                <FormControlLabel value="system" label={t("System")} control={<Radio />} />
                                <FormControlLabel value="light" label={t("Light")} control={<Radio />} />
                                <FormControlLabel value="dark" label={t("Dark")} control={<Radio />} />
                            </RadioGroup>
                        </FormControl>
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Layout")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpLayoutMode}
                                onChange={(e) => setTmpLayoutMode(e.target.value)}
                            >
                                <FormControlLabel value="one-column" label={t("1 Column")} control={<Radio />} />
                                <FormControlLabel value="two-column" label={t("2 Columns")} control={<Radio />} />
                            </RadioGroup>
                        </FormControl>
                    </Stack>
                    {/* ------------- アクティビティ関連設定 ------------- */}
                    <Stack spacing={3}>
                        {/* アクティビティフィルタの自動切り替え */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Activity Filter")}</FormLabel>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={tmpAutoFilter}
                                        onChange={(e) => setTmpAutoFilter(e.target.checked)}
                                    />
                                }
                                label={t("Auto-switch activity filter on select")}
                            />
                        </FormControl>
                        {/* 最近使用した項目を決めるしきい値の日数設定 */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Initial-Display Activities Used in")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpRecentDays}
                                onChange={(e) => setTmpRecentDays(e.target.value)}
                            >
                                {['7', '14', '30', 'all'].map(v =>
                                    <FormControlLabel
                                        key={v}
                                        value={v}
                                        control={<Radio />}
                                        label={v === 'all' ? t("Unlimited") : t("{count} days", { count: v })}
                                    />
                                )}
                            </RadioGroup>
                        </FormControl>
                        {/* 最近使用した項目として表示するactivityの件数の上限 */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Initial-Display Activities Limit")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpRecentLimit}
                                onChange={(e) => setTmpRecentLimit(e.target.value)}
                            >
                                {['5', '15', '30', 'all'].map(v =>
                                    <FormControlLabel
                                        key={v}
                                        value={v}
                                        control={<Radio />}
                                        label={v === 'all' ? t("Unlimited") : v}
                                    />
                                )}
                            </RadioGroup>
                        </FormControl>
                    </Stack>
                    {/* ------------- Discord連係関連設定 ------------- */}
                    <Stack spacing={3}>
                        {/* Discord 連係 ON/OFF */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Discord Integration")}</FormLabel>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={tmpDiscordEnabled}
                                        onChange={(e) => setTmpDiscordEnabled(e.target.checked)}
                                    />
                                }
                                label={t("Enable Discord Rich Presence")}
                            />
                        </FormControl>
                    </Stack>
                    {/* ------------- レコード保存モード ------------- */}
                    <Stack spacing={3}>
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Record Save Mode")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpRecordSaveMode}
                                onChange={e => setTmpRecordSaveMode(e.target.value)}
                            >
                                <FormControlLabel value="auto" control={<Radio />} label={t("Auto")} />
                                <FormControlLabel value="confirm" control={<Radio />} label={t("Confirm")} />
                            </RadioGroup>
                        </FormControl>
                    </Stack>
                </Stack>
            </DialogContent>

            <DialogActions>
                {/* Reset = 既定値に選択状態を戻す */}
                <Button
                    onClick={handleReset}
                    color="inherit"
                    sx={{ mr: 'auto', textTransform: 'none' }}
                >
                    {t("Reset to Defaults")}
                </Button>

                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    {/* Cancel = 変更を捨てて閉じるだけ */}
                    <Button onClick={onClose}>{t("Cancel")}</Button>

                    {/* Apply = Context に書き戻して閉じる */}
                    <Button
                        variant="contained"
                        onClick={() => {
                            setLanguage(tmpLanguage);
                            setAutoFilterOnSelect(tmpAutoFilter);
                            setThemeMode(tmpThemeMode);
                            setLayoutMode(tmpLayoutMode);
                            setRecentDays(tmpRecentDays);
                            setRecentLimit(tmpRecentLimit);
                            setDiscordEnabled(tmpDiscordEnabled);
                            setRecordSaveMode(tmpRecordSaveMode);
                            onClose();
                        }}
                    >
                        {t("Apply")}
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}

export default SettingsDialog;
