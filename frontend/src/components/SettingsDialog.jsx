import InfoTooltip from './InfoTooltip';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useSharedStopwatches } from '../services/stopwatches';
import { LanSettings } from './LanAccess';
import { useI18n } from '../i18n/I18nContext';
import { useState, useEffect, useRef } from 'react';
import {
    Alert,
    Typography,
    IconButton,
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

function SettingsSection({ title, children }) {
    return (
        <Box component="section">
            <Typography component="h2" variant="subtitle2" sx={{ color: theme => theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.55)' : 'rgba(0, 0, 0, 0.5)', fontWeight: 700, mb: 2 }}>{title}</Typography>
            <Stack spacing={2}>{children}</Stack>
        </Box>
    );
}

function SettingsDialog({ open, onClose }) {
    const { t } = useI18n();
    const shared = useSharedStopwatches();
    const canEditDiscord = shared.device?.is_local === true;
    const lanSettings = useRef(null);
    const applyingRef = useRef(false);
    const [applying, setApplying] = useState(false);
    const [lanReady, setLanReady] = useState(false);
    const [saveError, setSaveError] = useState('');
    const wasOpen = useRef(false);
    const originalSettings = useRef({});
    const resetRequested = useRef(false);
    const handleClose = () => {
        if (!applyingRef.current) {
            setDisplayPreview(null);
            onClose();
        }
    };
    const {
        isMobile,
        language: savedLanguage,
        autoFilterOnSelect, themeMode, layoutMode,
        recentDays, recentLimit, recentMinimum,
        discordEnabled, recordSaveMode, mergeConsecutiveRecords,
        showDockIcon,
        settingsError, saveSettings, setDisplayPreview,
    } = useSettings();

    // ─── 設定値のローカルコピー ───
    const [tmpLanguage, setTmpLanguage] = useState(savedLanguage);
    const [tmpAutoFilter, setTmpAutoFilter] = useState(autoFilterOnSelect);
    const [tmpThemeMode, setTmpThemeMode] = useState(themeMode);
    const [tmpLayoutMode, setTmpLayoutMode] = useState(layoutMode);
    const [tmpRecentDays, setTmpRecentDays] = useState(recentDays);
    const [tmpRecentLimit, setTmpRecentLimit] = useState(recentLimit);
    const [tmpRecentMinimum, setTmpRecentMinimum] = useState(recentMinimum);
    const [tmpDiscordEnabled, setTmpDiscordEnabled] = useState(discordEnabled);
    const [tmpRecordSaveMode, setTmpRecordSaveMode] = useState(recordSaveMode);
    const [tmpMergeConsecutiveRecords, setTmpMergeConsecutiveRecords] = useState(mergeConsecutiveRecords);
    const [tmpShowDockIcon, setTmpShowDockIcon] = useState(showDockIcon);
    // ダイアログを開くたびに最新値でリセット
    useEffect(() => {
        if (open && !wasOpen.current) {
            resetRequested.current = false;
            originalSettings.current = {
                language: savedLanguage, autoFilterOnSelect, themeMode, layoutMode,
                recentDays, recentLimit, recentMinimum, discordEnabled, recordSaveMode, mergeConsecutiveRecords,
                showDockIcon,
            };
            setSaveError('');
            setTmpLanguage(savedLanguage);
            setTmpAutoFilter(autoFilterOnSelect);
            setTmpThemeMode(themeMode);
            setTmpLayoutMode(layoutMode);
            setTmpRecentDays(recentDays);
            setTmpRecentLimit(recentLimit);
            setTmpRecentMinimum(recentLimit === 'all' ? recentMinimum : String(Math.min(Number(recentMinimum), Number(recentLimit))));
            setTmpDiscordEnabled(discordEnabled);
            setTmpRecordSaveMode(recordSaveMode);
            setTmpShowDockIcon(showDockIcon);
            setTmpMergeConsecutiveRecords(mergeConsecutiveRecords);
        }
        wasOpen.current = open;
    }, [open, savedLanguage, autoFilterOnSelect, themeMode, layoutMode, recentDays, recentLimit, recentMinimum, discordEnabled, recordSaveMode, mergeConsecutiveRecords, showDockIcon]);

    // 表示だけをプレビューし、閉じる際やアンマウント時に保存済みの表示へ戻す。
    useEffect(() => {
        if (open) setDisplayPreview({ language: tmpLanguage, themeMode: tmpThemeMode, layoutMode: tmpLayoutMode });
        return () => setDisplayPreview(null);
    }, [open, tmpLanguage, tmpThemeMode, tmpLayoutMode, setDisplayPreview]);

    // リセット用ハンドラ
    const handleReset = () => {
        // 既定値を適用
        resetRequested.current = true;
        setTmpLanguage(DEFAULT_SETTINGS.language);
        setTmpAutoFilter(DEFAULT_SETTINGS.autoFilterOnSelect);
        setTmpThemeMode(DEFAULT_SETTINGS.themeMode);
        setTmpLayoutMode(DEFAULT_SETTINGS.layoutMode);
        setTmpRecentDays(DEFAULT_SETTINGS.recentDays);
        setTmpRecentLimit(DEFAULT_SETTINGS.recentLimit);
        setTmpRecentMinimum(DEFAULT_SETTINGS.recentMinimum);
        setTmpDiscordEnabled(DEFAULT_SETTINGS.discordEnabled);
        setTmpRecordSaveMode(DEFAULT_SETTINGS.recordSaveMode);
        setTmpShowDockIcon(DEFAULT_SETTINGS.showDockIcon);
        setTmpMergeConsecutiveRecords(DEFAULT_SETTINGS.mergeConsecutiveRecords);
    };

    return (
        <Dialog fullScreen={isMobile} open={open} onClose={handleClose} maxWidth="sm">
            <DialogTitle>{t("App Settings")}</DialogTitle>

            <DialogContent dividers sx={{ '& legend.MuiFormLabel-root': { color: 'text.primary' } }}>
                <Stack component="fieldset" disabled={applying} sx={{ border: 0, m: 0, p: 0, minWidth: 0 }} spacing={3} divider={<Divider flexItem />}>
                    <SettingsSection title={t("Display settings")}>
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Language")}</FormLabel>
                            <RadioGroup row value={tmpLanguage} onChange={e => setTmpLanguage(e.target.value)}>
                                <FormControlLabel value="ja" label="日本語" control={<Radio />} />
                                <FormControlLabel value="en" label="English" control={<Radio />} />
                            </RadioGroup>
                        </FormControl>
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
                    </SettingsSection>
                    <SettingsSection title={t("Initial activity display")}>
                        {/* 最近使用した項目を決めるしきい値の日数設定 */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">
                                {t("Activity lookback period")}
                                <InfoTooltip title={t("Activities with records within the specified period are eligible for initial display.")}>
                                    <IconButton size="small" aria-label={t("About the activity history lookback period")} sx={{ ml: 0.5 }}>
                                        <InfoOutlinedIcon fontSize="small" />
                                    </IconButton>
                                </InfoTooltip>
                            </FormLabel>
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
                            <FormLabel component="legend">{t("Maximum activities")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpRecentLimit}
                                onChange={(e) => {
                                    const nextLimit = e.target.value;
                                    setTmpRecentLimit(nextLimit);
                                    // 上限を下げた場合は最低件数も上限以内に収める
                                    if (nextLimit !== 'all' && Number(tmpRecentMinimum) > Number(nextLimit)) {
                                        setTmpRecentMinimum(nextLimit);
                                    }
                                }}
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
                        {/* 期間内の対象が少ない場合に補充する最低件数 */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">{t("Minimum activities")}</FormLabel>
                            <RadioGroup
                                row
                                value={tmpRecentMinimum}
                                onChange={(e) => setTmpRecentMinimum(e.target.value)}
                            >
                                {['1', '5', '15', '30'].map(v =>
                                    <FormControlLabel
                                        key={v}
                                        value={v}
                                        control={<Radio />}
                                        label={v}
                                        disabled={tmpRecentLimit !== 'all' && Number(v) > Number(tmpRecentLimit)}
                                    />
                                )}
                            </RadioGroup>
                        </FormControl>
                    </SettingsSection>
                    <SettingsSection title={t("Timing and records")}>
                        {/* アクティビティフィルタの自動切り替え */}
                        <Stack direction="row" alignItems="center">
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={tmpAutoFilter}
                                        onChange={(e) => setTmpAutoFilter(e.target.checked)}
                                    />
                                }
                                label={t("Filter chart and heatmap when starting a timer")}
                                sx={{ mr: 0 }}
                            />
                            <InfoTooltip title={t("When you start timing an activity, the chart and heatmap are filtered to that activity. When OFF, the current filters are kept. The record list, calendar, and trends are not affected.")}>
                                <IconButton size="small" aria-label={t("About automatic activity filtering")}>
                                    <InfoOutlinedIcon fontSize="small" />
                                </IconButton>
                            </InfoTooltip>
                        </Stack>
                        <Stack direction="row" alignItems="center">
                            <FormControlLabel
                                control={<Switch checked={tmpRecordSaveMode === 'confirm'} onChange={e => setTmpRecordSaveMode(e.target.checked ? 'confirm' : 'auto')} />}
                                label={t("Show edit dialog when saving")}
                                sx={{ mr: 0 }}
                            />
                        </Stack>
                        <Stack direction="row" alignItems="center">
                            <FormControlLabel
                                control={<Switch checked={tmpMergeConsecutiveRecords} onChange={e => setTmpMergeConsecutiveRecords(e.target.checked)} />}
                                label={t("Merge consecutive records")}
                                sx={{ mr: 0 }}
                            />
                            <InfoTooltip title={t("Automatically merges records with the same activity and details when the gap between the end of one and the start of the next is 5 minutes or less. Records are not merged if another record occurs in between.")}>
                                <IconButton size="small" aria-label={t("About merging consecutive records")}>
                                    <InfoOutlinedIcon fontSize="small" />
                                </IconButton>
                            </InfoTooltip>
                        </Stack>
                    </SettingsSection>
                    <SettingsSection title={t("External integrations")}>
                        <Stack direction="row" alignItems="center">
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={canEditDiscord && tmpDiscordEnabled}
                                        disabled={!canEditDiscord}
                                        onChange={(e) => setTmpDiscordEnabled(e.target.checked)}
                                    />
                                }
                                label={t("Enable Discord Rich Presence")}
                                sx={{ mr: 0 }}
                            />
                            <InfoTooltip title={t("Discord integration requires the Discord desktop client and Chronoloft to be running on the same device.")}>
                                <IconButton size="small" aria-label={t("About Discord integration")}>
                                    <InfoOutlinedIcon fontSize="small" />
                                </IconButton>
                            </InfoTooltip>
                        </Stack>
                    </SettingsSection>
                    <SettingsSection title={t("Device and connection")}>
                        {typeof window !== 'undefined' && window.pywebview?.api?.desktop_ready && <FormControlLabel
                            control={<Switch checked={tmpShowDockIcon} onChange={e => setTmpShowDockIcon(e.target.checked)} />}
                            label={t('Show icon in Dock')}
                        />}
                        {open && <LanSettings ref={lanSettings} disabled={applying} onReadyChange={setLanReady} />}
                    </SettingsSection>
                </Stack>
            </DialogContent>

            {(saveError || settingsError) && <Alert severity="error" sx={{ mx: 3, mt: 1 }}>{saveError || settingsError}</Alert>}
            <DialogActions>
                {/* Reset = 既定値に選択状態を戻す */}
                <Button
                    disabled={applying}
                    onClick={handleReset}
                    color="inherit"
                    sx={{ mr: 'auto', textTransform: 'none' }}
                >
                    {t("Reset to Defaults")}
                </Button>

                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    {/* Cancel = 変更を捨てて閉じるだけ */}
                    <Button disabled={applying} onClick={handleClose}>{t("Cancel")}</Button>

                    {/* Apply = Context に書き戻して閉じる */}
                    <Button
                        variant="contained"
                        disabled={applying || !lanReady}
                        onClick={async () => {
                            if (applyingRef.current) return;
                            applyingRef.current = true;
                            setApplying(true);
                            setSaveError('');
                            try {
                                await lanSettings.current.save();
                                const next = {
                                    language: tmpLanguage, autoFilterOnSelect: tmpAutoFilter,
                                    themeMode: tmpThemeMode, layoutMode: tmpLayoutMode,
                                    recentDays: tmpRecentDays, recentLimit: tmpRecentLimit,
                                    recentMinimum: tmpRecentMinimum, discordEnabled: tmpDiscordEnabled,
                                    recordSaveMode: tmpRecordSaveMode,
                                    mergeConsecutiveRecords: tmpMergeConsecutiveRecords,
                                    showDockIcon: tmpShowDockIcon,
                                };
                                // 通常は変更した項目だけを保存し、明示的なリセットでは全項目を反映する。
                                const changes = Object.fromEntries(Object.entries(next).filter(
                                    ([key, value]) => (key !== 'discordEnabled' || canEditDiscord)
                                        && (resetRequested.current || value !== originalSettings.current[key])));
                                await saveSettings(changes);
                                setDisplayPreview(null);
                                onClose();
                            } catch (error) {
                                setSaveError(error.message || '設定を保存できませんでした。');
                            } finally {
                                applyingRef.current = false;
                                setApplying(false);
                            }
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
