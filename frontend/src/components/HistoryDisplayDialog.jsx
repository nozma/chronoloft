import React, { useState, useEffect } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    FormControlLabel,
    Switch,
    Stack,
    Divider,
    Box,
} from '@mui/material';
import { useUI } from '../contexts/UIContext';

const DEFAULT_VISIBILITY = {
    showChart: true,
    showHeatmap: true,
    showCalendar: true,
    showRecords: true,
};

function HistoryDisplayDialog({ open, onClose }) {
    const { state: uiState, dispatch: uiDispatch } = useUI();

    const [tmpShowChart, setTmpShowChart] = useState(uiState.showChart);
    const [tmpShowHeatmap, setTmpShowHeatmap] = useState(uiState.showHeatmap);
    const [tmpShowCalendar, setTmpShowCalendar] = useState(uiState.showCalendar);
    const [tmpShowRecords, setTmpShowRecords] = useState(uiState.showRecords);

    useEffect(() => {
        if (open) {
            setTmpShowChart(uiState.showChart);
            setTmpShowHeatmap(uiState.showHeatmap);
            setTmpShowCalendar(uiState.showCalendar);
            setTmpShowRecords(uiState.showRecords);
        }
    }, [open, uiState]);

    const handleReset = () => {
        setTmpShowChart(DEFAULT_VISIBILITY.showChart);
        setTmpShowHeatmap(DEFAULT_VISIBILITY.showHeatmap);
        setTmpShowCalendar(DEFAULT_VISIBILITY.showCalendar);
        setTmpShowRecords(DEFAULT_VISIBILITY.showRecords);
    };

    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm">
            <DialogTitle>History Items</DialogTitle>

            <DialogContent dividers>
                <Stack spacing={3} divider={<Divider flexItem />}>
                    <FormControlLabel
                        control={<Switch checked={tmpShowChart} onChange={e => setTmpShowChart(e.target.checked)} />}
                        label="Show Chart"
                    />
                    <FormControlLabel
                        control={<Switch checked={tmpShowHeatmap} onChange={e => setTmpShowHeatmap(e.target.checked)} />}
                        label="Show Heatmap"
                    />
                    <FormControlLabel
                        control={<Switch checked={tmpShowCalendar} onChange={e => setTmpShowCalendar(e.target.checked)} />}
                        label="Show Calendar"
                    />
                    <FormControlLabel
                        control={<Switch checked={tmpShowRecords} onChange={e => setTmpShowRecords(e.target.checked)} />}
                        label="Show Records"
                    />
                </Stack>
            </DialogContent>

            <DialogActions>
                <Button onClick={handleReset} color="inherit" sx={{ mr: 'auto', textTransform: 'none' }}>
                    Reset to Defaults
                </Button>
                <Box sx={{ ml: 'auto', display: 'flex', gap: 1 }}>
                    <Button onClick={onClose}>Cancel</Button>
                    <Button
                        variant="contained"
                        onClick={() => {
                            uiDispatch({
                                type: 'UPDATE_UI',
                                payload: {
                                    showChart: tmpShowChart,
                                    showHeatmap: tmpShowHeatmap,
                                    showCalendar: tmpShowCalendar,
                                    showRecords: tmpShowRecords,
                                },
                            });
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

export default HistoryDisplayDialog;
