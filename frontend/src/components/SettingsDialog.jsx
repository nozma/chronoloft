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
    const {
        autoFilterOnSelect, setAutoFilterOnSelect,
        themeMode, setThemeMode,
        recentDays, setRecentDays,
        recentLimit, setRecentLimit,
    } = useSettings();

    // ─── 設定値のローカルコピー ───
    const [tmpAutoFilter, setTmpAutoFilter] = useState(autoFilterOnSelect);
    const [tmpThemeMode, setTmpThemeMode] = useState(themeMode);
    const [tmpRecentDays, setTmpRecentDays] = useState(recentDays);
    const [tmpRecentLimit, setTmpRecentLimit] = useState(recentLimit);
    // ダイアログを開くたびに最新値でリセット
    useEffect(() => {
        if (open) {
            setTmpAutoFilter(autoFilterOnSelect);
            setTmpThemeMode(themeMode);
            setTmpRecentDays(recentDays);
            setTmpRecentLimit(recentLimit);
        }
    }, [open, autoFilterOnSelect, themeMode, recentDays, recentLimit]);

    // リセット用ハンドラ
    const handleReset = () => {
        // 既定値を適用
        setTmpAutoFilter(DEFAULT_SETTINGS.autoFilterOnSelect);
        setTmpThemeMode(DEFAULT_SETTINGS.themeMode);
        setTmpRecentDays(DEFAULT_SETTINGS.recentDays);
        setTmpRecentLimit(DEFAULT_SETTINGS.recentLimit);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm">
            <DialogTitle>Settings</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={3} divider={<Divider flexItem />}>
                    {/* ------------- 外観関連設定 ------------- */}
                    <Stack spacing={3}>
                        {/* ダークモード・ライトモード切り替え */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">Theme</FormLabel>
                            <RadioGroup
                                row
                                value={tmpThemeMode}
                                onChange={(e) => setTmpThemeMode(e.target.value)}
                            >
                                <FormControlLabel value="system" label="System" control={<Radio />} />
                                <FormControlLabel value="light" label="Light" control={<Radio />} />
                                <FormControlLabel value="dark" label="Dark" control={<Radio />} />
                            </RadioGroup>
                        </FormControl>
                    </Stack>
                    {/* ------------- アクティビティ関連設定 ------------- */}
                    <Stack spacing={3}>
                        {/* アクティビティフィルタの自動切り替え */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">Activity Filter</FormLabel>
                            <FormControlLabel
                                control={
                                    <Switch
                                        checked={tmpAutoFilter}
                                        onChange={(e) => setTmpAutoFilter(e.target.checked)}
                                    />
                                }
                                label="Auto-switch activity filter on select"
                            />
                        </FormControl>
                        {/* 最近使用した項目を決めるしきい値の日数設定 */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">Initial-Display Activities Used in</FormLabel>
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
                                        label={v === 'all' ? 'Unlimited' : `${v}d`}
                                    />
                                )}
                            </RadioGroup>
                        </FormControl>
                        {/* 最近使用した項目として表示するactivityの件数の上限 */}
                        <FormControl component="fieldset">
                            <FormLabel component="legend">Initial-Display Activities Limit</FormLabel>
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
                                        label={v === 'all' ? 'Unlimited' : v}
                                    />
                                )}
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
                    sx={{ mr: 'auto', textTransform:'none' }}
                >
                    Reset to Defaults
                </Button>

                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    {/* Cancel = 変更を捨てて閉じるだけ */}
                    <Button onClick={onClose}>Cancel</Button>

                    {/* Apply = Context に書き戻して閉じる */}
                    <Button
                        variant="contained"
                        onClick={() => {
                            setAutoFilterOnSelect(tmpAutoFilter);
                            setThemeMode(tmpThemeMode);
                            setRecentDays(tmpRecentDays);
                            setRecentLimit(tmpRecentLimit);
                            onClose();
                        }}
                    >
                        Apply
                    </Button>
                </Box>
            </DialogActions>
        </Dialog>
    );
}

export default SettingsDialog;