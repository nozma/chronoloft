import React from 'react';
import { Box, Typography } from '@mui/material';
import RecordList from './RecordList';
import RecordHeatmap from './RecordHeatmap';
import RecordCalendar from './RecordCalendar';
import { useUI } from '../contexts/UIContext';
import { useRecords } from '../contexts/RecordContext';

function History({ onRecordUpdate }) {
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { records } = useRecords();
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
            {/* Heatmap */}
            <RecordHeatmap />

            {/* Calendar */}
            <RecordCalendar />

            {/* Record List */}
            <RecordList
                records={records}
                onRecordUpdate={onRecordUpdate}
            />
        </Box>
    );
}

export default History;