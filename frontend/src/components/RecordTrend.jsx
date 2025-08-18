import React, { useMemo, useState } from 'react';
import {
    Box,
    Typography,
    Collapse,
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableRow,
    TablePagination,
    TextField,
    MenuItem
} from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import { DateTime } from 'luxon';
import { useRecords } from '../contexts/RecordContext';
import { useUI } from '../contexts/UIContext';
import { useFilter } from '../contexts/FilterContext';
import useLocalStorageState from '../hooks/useLocalStorageState';

function groupRecords(records, groupBy) {
    const now = DateTime.local();
    const start7 = now.minus({ days: 7 });
    const start14 = now.minus({ days: 14 });
    const start30 = now.minus({ days: 30 });
    const start60 = now.minus({ days: 60 });
    const map = new Map();

    records.forEach(rec => {
        let keys = [];
        if (groupBy === 'activity') {
            keys.push(rec.activity_name || 'Unknown Activity');
        } else if (groupBy === 'group') {
            keys.push(rec.activity_group || 'Unknown Group');
        } else if (groupBy === 'tag') {
            if (rec.tags && rec.tags.length > 0) {
                rec.tags.forEach(t => keys.push(t.name));
            } else {
                keys.push('No Tag');
            }
        }
        const dt = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
        keys.forEach(key => {
            if (!map.has(key)) {
                map.set(key, {
                    name: key,
                    unit: rec.unit,
                    total7: 0,
                    prev7: 0,
                    total30: 0,
                    prev30: 0,
                    last: dt
                });
            }
            const obj = map.get(key);
            if (dt > obj.last) obj.last = dt;
            if (dt >= start7) obj.total7 += rec.value;
            else if (dt >= start14) obj.prev7 += rec.value;
            if (dt >= start30) obj.total30 += rec.value;
            else if (dt >= start60) obj.prev30 += rec.value;
        });
    });

    const arr = [];
    map.forEach(v => {
        const total60 = v.total30 + v.prev30;
        if (total60 === 0) return;
        arr.push({
            ...v,
            diff7: v.total7 - v.prev7,
            diff30: v.total30 - v.prev30,
            rate7: v.prev7 === 0 ? null : ((v.total7 / v.prev7 - 1) * 100),
            rate30: v.prev30 === 0 ? null : ((v.total30 / v.prev30 - 1) * 100)
        });
    });
    return arr;
}

function formatDiff(val, unit) {
    const sign = val > 0 ? '+' : val < 0 ? '-' : '';
    const abs = Math.abs(val);
    if (unit === 'minutes') {
        const hours = Math.floor(abs / 60);
        const minutes = Math.floor(abs % 60);
        return `${sign}${hours}:${String(minutes).padStart(2, '0')}`;
    }
    return `${sign}${Math.round(abs)}`;
}

function formatValue(val, unit) {
    const abs = Math.abs(val);
    const sign = val < 0 ? '-' : '';
    if (unit === 'minutes') {
        const hours = Math.floor(abs / 60);
        const minutes = Math.floor(abs % 60);
        return `${sign}${hours}:${String(minutes).padStart(2, '0')}`;
    }
    return `${sign}${Math.round(abs)}`;
}

function formatDailyAverage(total, unit, days) {
    const avg = Math.round(total / days);
    if (unit === 'minutes') {
        const hours = Math.floor(avg / 60);
        const minutes = Math.floor(avg % 60);
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}/d`;
    }
    return `${avg}/d`;
}

function formatRate(total, prev) {
    if (total === 0 && prev === 0) return ' - ';
    if (total !== 0 && prev === 0) return 'new!!';
    const rate = (total / prev - 1) * 100;
    return `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`;
}

function sortIncrease(data, by) {
    const totalField = by === '7day' ? 'total7' : 'total30';
    const prevField = by === '7day' ? 'prev7' : 'prev30';
    return [...data].sort((a, b) => {
        const aNew = a[totalField] !== 0 && a[prevField] === 0;
        const bNew = b[totalField] !== 0 && b[prevField] === 0;
        if (aNew && !bNew) return -1;
        if (!aNew && bNew) return 1;
        const aZero = a[totalField] === 0 && a[prevField] === 0;
        const bZero = b[totalField] === 0 && b[prevField] === 0;
        if (aZero && !bZero) return 1;
        if (!aZero && bZero) return -1;
        const rateA = a[prevField] === 0 ? -Infinity : (a[totalField] / a[prevField] - 1);
        const rateB = b[prevField] === 0 ? -Infinity : (b[totalField] / b[prevField] - 1);
        if (rateB !== rateA) return rateB - rateA;
        if (b[totalField] !== a[totalField]) return b[totalField] - a[totalField];
        return b.last - a.last;
    });
}

function sortDecrease(data, by) {
    const totalField = by === '7day' ? 'total7' : 'total30';
    const prevField = by === '7day' ? 'prev7' : 'prev30';
    return [...data].sort((a, b) => {
        const rateA = a[prevField] === 0 ? Infinity : (a[totalField] / a[prevField] - 1);
        const rateB = b[prevField] === 0 ? Infinity : (b[totalField] / b[prevField] - 1);
        if (rateA !== rateB) return rateA - rateB;
        if (a[totalField] !== b[totalField]) return a[totalField] - b[totalField];
        return a.last - b.last;
    });
}

function RecordTrend() {
    const { records } = useRecords();
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { filterState } = useFilter();
    const [groupBy, setGroupBy] = useLocalStorageState('trend.groupBy', 'activity');
    const [selectedPeriod, setSelectedPeriod] = useLocalStorageState('trend.selectedPeriod', '30day');
    const [incPage, setIncPage] = useState(0);
    const [decPage, setDecPage] = useState(0);

    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filterState.groupFilter && r.activity_group !== filterState.groupFilter) return false;
            if (filterState.tagFilter) {
                const tagNames = r.tags ? r.tags.map(t => t.name) : [];
                if (!tagNames.includes(filterState.tagFilter)) return false;
            }
            return true;
        });
    }, [records, filterState]);

    const grouped = useMemo(() => groupRecords(filteredRecords, groupBy), [filteredRecords, groupBy]);
    const increase = useMemo(() => sortIncrease(grouped, selectedPeriod), [grouped, selectedPeriod]);
    const decrease = useMemo(() => sortDecrease(grouped, selectedPeriod), [grouped, selectedPeriod]);

    const incRows = increase.slice(incPage * 10, incPage * 10 + 10);
    const decRows = decrease.slice(decPage * 10, decPage * 10 + 10);

    return (
        <Box sx={{ mb: 1 }}>
            <Typography
                variant='caption'
                color='#cccccc'
                sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                onClick={() => uiDispatch({ type: 'SET_TREND_OPEN', payload: !uiState.trendOpen })}
            >
                Trend
                <KeyboardArrowRightIcon
                    fontSize='small'
                    sx={{
                        transition: 'transform 0.15s linear',
                        transform: uiState.trendOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        marginLeft: '4px'
                    }}
                />
            </Typography>
            <Collapse in={uiState.trendOpen}>
                <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                    <TextField select size='small' label='Group By' value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                        <MenuItem value='activity'>Activity</MenuItem>
                        <MenuItem value='tag'>Tag</MenuItem>
                        <MenuItem value='group'>Group</MenuItem>
                    </TextField>
                    <TextField select size='small' label='Date Range' value={selectedPeriod} onChange={e => { setSelectedPeriod(e.target.value); setIncPage(0); setDecPage(0); }}>
                        <MenuItem value='30day'>30 Days</MenuItem>
                        <MenuItem value='7day'>7 Days</MenuItem>
                    </TextField>
                </Box>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Box sx={{ flex: 1, minWidth: 320, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size='small' sx={(theme) => ({ backgroundColor: theme.palette.mode === 'dark' ? '#222' : '#fafafa' })}>
                            <TableHead sx={(theme) => ({ backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)' })}>
                                <TableRow>
                                    <TableCell>Increase Ranking</TableCell>
                                    <TableCell align='right'>Total</TableCell>
                                    <TableCell align='center'>Change</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {incRows.map(row => {
                                    const diff = selectedPeriod === '7day' ? row.diff7 : row.diff30;
                                    const total = selectedPeriod === '7day' ? row.total7 : row.total30;
                                    const prev = selectedPeriod === '7day' ? row.prev7 : row.prev30;
                                    return (
                                        <TableRow key={row.name}>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell align='right'>
                                                {formatValue(total, row.unit)}
                                                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: -1 }}>
                                                    {formatDailyAverage(total, row.unit, selectedPeriod === '7day' ? 7 : 30)}
                                                </span>
                                            </TableCell>
                                            <TableCell
                                                align='center'
                                                sx={(theme) => ({
                                                    color:
                                                        diff > 0
                                                            ? theme.palette.mode === 'dark'
                                                                ? theme.palette.success.light
                                                                : theme.palette.success.dark
                                                            : diff < 0
                                                                ? theme.palette.mode === 'dark'
                                                                    ? theme.palette.error.light
                                                                    : theme.palette.error.dark
                                                                : 'inherit',
                                                })}
                                            >
                                                {formatDiff(diff, row.unit)}
                                                {diff > 0 ? <TrendingUpIcon fontSize='inherit' /> : diff < 0 ? <TrendingDownIcon fontSize='inherit' /> : null}
                                                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: -1 }}>
                                                    {formatRate(total, prev)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component='div'
                            count={increase.length}
                            page={incPage}
                            onPageChange={(e, p) => setIncPage(p)}
                            rowsPerPage={10}
                            rowsPerPageOptions={[10]}
                            sx={{ '& .MuiToolbar-root': { minHeight: 36, height: 36 } }}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 320, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table size='small' sx={(theme) => ({ backgroundColor: theme.palette.mode === 'dark' ? '#222' : '#fafafa' })}>
                            <TableHead sx={(theme) => ({ backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)' })}>
                                <TableRow>
                                    <TableCell>Decrease Ranking</TableCell>
                                    <TableCell align='right'>Total</TableCell>
                                    <TableCell align='center'>Change</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {decRows.map(row => {
                                    const diff = selectedPeriod === '7day' ? row.diff7 : row.diff30;
                                    const total = selectedPeriod === '7day' ? row.total7 : row.total30;
                                    const prev = selectedPeriod === '7day' ? row.prev7 : row.prev30;
                                    return (
                                        <TableRow key={row.name}>
                                            <TableCell>{row.name}</TableCell>
                                            <TableCell align='right'>
                                                {formatValue(total, row.unit)}
                                                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: -1 }}>
                                                    {formatDailyAverage(total, row.unit, selectedPeriod === '7day' ? 7 : 30)}
                                                </span>
                                            </TableCell>
                                            <TableCell
                                                align='center'
                                                sx={(theme) => ({
                                                    color:
                                                        diff > 0
                                                            ? theme.palette.mode === 'dark'
                                                                ? theme.palette.success.light
                                                                : theme.palette.success.dark
                                                            : diff < 0
                                                                ? theme.palette.mode === 'dark'
                                                                    ? theme.palette.error.light
                                                                    : theme.palette.error.dark
                                                                : 'inherit',
                                                })}
                                            >
                                                {formatDiff(diff, row.unit)}
                                                {diff > 0 ? <TrendingUpIcon fontSize='inherit' /> : diff < 0 ? <TrendingDownIcon fontSize='inherit' /> : null}
                                                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: -1 }}>
                                                    {formatRate(total, prev)}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                        <TablePagination
                            component='div'
                            count={decrease.length}
                            page={decPage}
                            onPageChange={(e, p) => setDecPage(p)}
                            rowsPerPage={10}
                            rowsPerPageOptions={[10]}
                            sx={{ '& .MuiToolbar-root': { minHeight: 36, height: 36 } }}
                        />
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}

export default RecordTrend;
