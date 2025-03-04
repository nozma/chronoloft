import React from 'react';
import { Box } from '@mui/material';
import RecordList from './RecordList';
import RecordHeatmap from './RecordHeatmap';
import RecordCalendar from './RecordCalendar';

function History({ records, onRecordUpdate }) {
  return (
    <Box sx={{ mb: 2 }}>
      {/* Heatmap */}
      <RecordHeatmap records={records} />

      {/* Calendar */}
      <RecordCalendar records={records} />

      {/* Record List */}
      <RecordList
        records={records}
        onRecordUpdate={onRecordUpdate}
      />
    </Box>
  );
}

export default History;