import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    FormControlLabel,
    Switch,
    FormControl,
    FormLabel,
    Radio,
    RadioGroup,
} from '@mui/material';
import { useSettings } from '../contexts/SettingsContext';

function SettingsDialog({ open, onClose }) {
    const {
        autoFilterOnSelect, setAutoFilterOnSelect,
        themeMode, setThemeMode,
    } = useSettings();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Settings</DialogTitle>

            <DialogContent dividers>
                <FormControlLabel
                    control={
                        <Switch
                            checked={autoFilterOnSelect}
                            onChange={(e) => setAutoFilterOnSelect(e.target.checked)}
                        />
                    }
                    label="Auto-switch activity filter when activity is selected"
                />
                {/* ★ テーマ切替ラジオ */}
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