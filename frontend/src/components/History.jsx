import React from 'react';
import { Box, Typography } from '@mui/material';
import RecordList from './RecordList';
import RecordHeatmap from './RecordHeatmap';
import RecordCalendar from './RecordCalendar';
import RecordChart from './RecordChart';
import { useUI } from '../contexts/UIContext';

function History() {
    const { dispatch: uiDispatch } = useUI();
    return (
        <Box sx={{ mb: 2 }}>
            {/* Heading / Title */}
            <Box sx={{ display: 'flex', gap: 2, mb: 2, alignItems: 'baseline' }}>
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
            </Box>
            <RecordChart />
            <RecordHeatmap />
            <RecordCalendar />
            <RecordList />
        </Box>
    );
}

export default History;