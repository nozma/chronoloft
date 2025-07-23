import React, { useState } from 'react';
import { Box, Typography, IconButton } from '@mui/material';
import RecordList from './RecordList';
import RecordHeatmap from './RecordHeatmap';
import RecordCalendar from './RecordCalendar';
import RecordChart from './RecordChart';
import { useUI } from '../contexts/UIContext';
import SettingsIcon from '@mui/icons-material/Settings';
import HistoryDisplayDialog from './HistoryDisplayDialog';

function History() {
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const [settingsOpen, setSettingsOpen] = useState(false);

    const componentsMap = {
        chart: uiState.showChart ? <RecordChart key="chart" /> : null,
        heatmap: uiState.showHeatmap ? <RecordHeatmap key="heatmap" /> : null,
        calendar: uiState.showCalendar ? <RecordCalendar key="calendar" /> : null,
        records: uiState.showRecords ? <RecordList key="records" /> : null,
    };

    return (
        <Box sx={{ mb: 2 }}>
            {/* Heading / Title */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, pb: 0.5, alignItems: 'baseline', borderBottom: '1px solid #333' }}>
                <Typography variant="h5" sx={{ mr: 2 }}>
                    History
                </Typography>
                <Typography
                    variant='caption'
                    color='#ccc'
                    onClick={() =>
                        uiDispatch({
                            type: 'UPDATE_UI',
                            payload: {
                                chartOpen: true,
                                recordsOpen: true,
                                heatmapOpen: true,
                                calendarOpen: true,
                            }
                        })
                    }
                    sx={{ cursor: 'pointer' }}
                >
                    Open All
                </Typography>
                <Typography
                    variant='caption'
                    color='#ccc'
                    onClick={() =>
                        uiDispatch({
                            type: 'UPDATE_UI',
                            payload: {
                                chartOpen: false,
                                recordsOpen: false,
                                heatmapOpen: false,
                                calendarOpen: false,
                            }
                        })
                    }
                    sx={{ cursor: 'pointer' }}
                >
                    Close All
                </Typography>
                <Box sx={{ flexGrow: 1 }} />
                <IconButton size="small" onClick={() => setSettingsOpen(true)}>
                    <SettingsIcon fontSize='small' />
                </IconButton>
            </Box>
            {uiState.historyOrder.map(key => componentsMap[key])}
            <HistoryDisplayDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </Box>
    );
}

export default History;