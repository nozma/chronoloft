import React from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    MenuItem,
    Stack,
} from '@mui/material';

function ChartSettingsDialog({
    open,
    onClose,
    itemLimit,
    setItemLimit,
    selectedPeriod,
    setSelectedPeriod,
    setOffset,
    chartType,
    setChartType,
    xAxisUnit,
    setXAxisUnit,
    groupBy,
    setGroupBy,
    aggregationUnit,
    setAggregationUnit,
    setIsAggregationManual,
}) {
    return (
        <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
            <DialogTitle>Chart Settings</DialogTitle>
            <DialogContent dividers>
                <Stack spacing={2}>
                    <TextField
                        select
                        label="Item Limit"
                        size="small"
                        value={itemLimit}
                        onChange={(e) => setItemLimit(e.target.value)}
                        fullWidth
                    >
                        <MenuItem value="unlimited">Unlimited</MenuItem>
                        <MenuItem value="5">5</MenuItem>
                        <MenuItem value="10">10</MenuItem>
                        <MenuItem value="15">15</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Date Range"
                        size="small"
                        value={selectedPeriod}
                        onChange={(e) => {
                            setSelectedPeriod(e.target.value);
                            setOffset(0);
                            if (e.target.value === '1d') {
                                setChartType('bar');
                            }
                        }}
                        fullWidth
                    >
                        <MenuItem value="all">All</MenuItem>
                        <MenuItem value="365d">365 Days</MenuItem>
                        <MenuItem value="180d">180 Days</MenuItem>
                        <MenuItem value="90d">90 Days</MenuItem>
                        <MenuItem value="30d">30 Days</MenuItem>
                        <MenuItem value="7d">7 Days</MenuItem>
                        <MenuItem value="1d">1 Day</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Chart Type"
                        variant="outlined"
                        size="small"
                        value={chartType}
                        onChange={(e) => setChartType(e.target.value)}
                        disabled={selectedPeriod === '1d'}
                        fullWidth
                    >
                        <MenuItem value="line">Line</MenuItem>
                        <MenuItem value="bar">Bar</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Interval"
                        size="small"
                        value={xAxisUnit}
                        onChange={(e) => setXAxisUnit(e.target.value)}
                        fullWidth
                    >
                        <MenuItem value="day">Day</MenuItem>
                        <MenuItem value="week">Week</MenuItem>
                        <MenuItem value="month">Month</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Grouping"
                        size="small"
                        value={groupBy}
                        onChange={(e) => setGroupBy(e.target.value)}
                        fullWidth
                    >
                        <MenuItem value="group">Group</MenuItem>
                        <MenuItem value="tag">Tag</MenuItem>
                        <MenuItem value="activity">Activity</MenuItem>
                        <MenuItem value="activityMemo">Activity + Memo</MenuItem>
                    </TextField>
                    <TextField
                        select
                        label="Unit"
                        size="small"
                        value={aggregationUnit}
                        onChange={(e) => {
                            setAggregationUnit(e.target.value);
                            setIsAggregationManual(true);
                        }}
                        fullWidth
                    >
                        <MenuItem value="time">Time</MenuItem>
                        <MenuItem value="count">Count</MenuItem>
                    </TextField>
                </Stack>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose}>Close</Button>
            </DialogActions>
        </Dialog>
    );
}

export default ChartSettingsDialog;
