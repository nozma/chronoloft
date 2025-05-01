import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    Typography,
    FormControlLabel,
    Switch
} from '@mui/material';
import { useSettings } from '../contexts/SettingsContext';

function SettingsDialog({ open, onClose }) {
    const { autoFilterOnSelect, setAutoFilterOnSelect } = useSettings();

    return (
        <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
            <DialogTitle>Settings</DialogTitle>

            <DialogContent>
                <FormControlLabel
                    control={
                        <Switch
                            checked={autoFilterOnSelect}
                            onChange={(e) => setAutoFilterOnSelect(e.target.checked)}
                        />
                    }
                    label="Auto-switch activity filter when activity is selected"
                />
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