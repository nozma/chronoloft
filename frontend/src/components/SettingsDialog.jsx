import React from 'react';
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
    Stack
} from '@mui/material';
import { useSettings } from '../contexts/SettingsContext';

function SettingsDialog({ open, onClose }) {
    const {
        autoFilterOnSelect, setAutoFilterOnSelect,
        themeMode, setThemeMode,
        recentDays, setRecentDays,
        recentLimit, setRecentLimit,
    } = useSettings();

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm">
            <DialogTitle>Settings</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={3}>
                    {/* アクティビティフィルタの自動切り替え */}
                    <FormControl component="fieldset">
                        <FormLabel component="legend">Activity Filter</FormLabel>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={autoFilterOnSelect}
                                    onChange={(e) => setAutoFilterOnSelect(e.target.checked)}
                                />
                            }
                            label="Auto-switch activity filter on select"
                        />
                    </FormControl>
                    {/* ダークモード・ライトモード切り替え */}
                    <FormControl component="fieldset">
                        <FormLabel component="legend">Theme</FormLabel>
                        <RadioGroup
                            row
                            value={themeMode}
                            onChange={(e) => setThemeMode(e.target.value)}
                        >
                            <FormControlLabel value="system" label="System" control={<Radio />} />
                            <FormControlLabel value="light" label="Light" control={<Radio />} />
                            <FormControlLabel value="dark" label="Dark" control={<Radio />} />
                        </RadioGroup>
                    </FormControl>
                    {/* 最近使用した項目を決めるしきい値の日数設定 */}
                    <FormControl component="fieldset">
                        <FormLabel component="legend">Initial-Display Activities Used in</FormLabel>
                        <RadioGroup
                            row
                            value={recentDays}
                            onChange={(e) => setRecentDays(e.target.value)}
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
                            value={recentLimit}
                            onChange={(e) => setRecentLimit(e.target.value)}
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
            </DialogContent>

            <DialogActions>
                <Button onClick={onClose} variant="contained">
                    Close
                </Button>
            </DialogActions>
        </Dialog>
    );
}

export default SettingsDialog;