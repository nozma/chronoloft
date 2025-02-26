import React from 'react';
import { Box, Typography } from '@mui/material';
import ActivityList from './ActivityList';

function RecordingInterface({ onRecordUpdate, records }) {
    return (
        <Box sx={{ mb: 2 }}>
            {/* Heading / Title */}
            <Typography variant="h5" sx={{ mb: 2 }}>
                Record Your Activity
            </Typography>
            <ActivityList onRecordUpdate={onRecordUpdate} records={records} />

            {/* Add filters, activity list, stopwatch UI, etc. here */}
            {/* <GroupFilter /> */}
            {/* <TagFilter /> */}
            {/* <ActivityList /> */}
            {/* <Stopwatch /> or <RecordCreationDialog /> */}
        </Box>
    );
}

export default RecordingInterface;