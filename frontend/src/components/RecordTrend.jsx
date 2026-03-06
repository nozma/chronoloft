import { useMemo, useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react';
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
    MenuItem,
    Button,
    Tooltip
} from '@mui/material';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import SettingsIcon from '@mui/icons-material/Settings';
import { DateTime } from 'luxon';
import { useRecords } from '../contexts/RecordContext';
import { useGroups } from '../contexts/GroupContext';
import { useActivities } from '../contexts/ActivityContext';
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
    const avg = total / days;
    if (unit === 'minutes') {
        const rounded = Math.round(avg);
        const hours = Math.floor(rounded / 60);
        const minutes = Math.floor(rounded % 60);
        return `${String(hours)}:${String(minutes).padStart(2, '0')}/d`;
    }
    if (unit === 'count') {
        return `${avg.toFixed(1)}/d`;
    }
    return `${Math.round(avg)}/d`;
}

function formatRate(total, prev) {
    if (total === 0 && prev === 0) return ' - ';
    if (total !== 0 && prev === 0) return 'new!!';
    const rate = (total / prev - 1) * 100;
    return `${rate >= 0 ? '+' : ''}${rate.toFixed(1)}%`;
}

function sortIncrease(data, by) {
    if (by === '7v30') {
        return [...data].sort((a, b) => {
            const baseA = (a.total30 * 7) / 30;
            const baseB = (b.total30 * 7) / 30;
            const aNew = a.total7 !== 0 && baseA === 0;
            const bNew = b.total7 !== 0 && baseB === 0;
            if (aNew && !bNew) return -1;
            if (!aNew && bNew) return 1;
            const aZero = a.total7 === 0 && baseA === 0;
            const bZero = b.total7 === 0 && baseB === 0;
            if (aZero && !bZero) return 1;
            if (!aZero && bZero) return -1;
            const rateA = baseA === 0 ? -Infinity : (a.total7 / baseA - 1);
            const rateB = baseB === 0 ? -Infinity : (b.total7 / baseB - 1);
            if (rateB !== rateA) return rateB - rateA;
            if (b.total7 !== a.total7) return b.total7 - a.total7;
            return b.last - a.last;
        });
    }
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
    if (by === '7v30') {
        return [...data].sort((a, b) => {
            const baseA = (a.total30 * 7) / 30;
            const baseB = (b.total30 * 7) / 30;
            const rateA = baseA === 0 ? Infinity : (a.total7 / baseA - 1);
            const rateB = baseB === 0 ? Infinity : (b.total7 / baseB - 1);
            if (rateA !== rateB) return rateA - rateB;
            if (a.total7 !== b.total7) return a.total7 - b.total7;
            return a.last - b.last;
        });
    }
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

function TruncatedTrendName({ text }) {
    const textRef = useRef(null);
    const [isTruncated, setIsTruncated] = useState(false);

    const measureTruncation = useCallback(() => {
        const element = textRef.current;
        if (!element) return;
        setIsTruncated(
            element.scrollHeight > element.clientHeight + 1 ||
            element.scrollWidth > element.clientWidth + 1
        );
    }, []);

    useLayoutEffect(() => {
        const element = textRef.current;
        if (!element) return;

        const rafId = window.requestAnimationFrame(measureTruncation);

        if (typeof ResizeObserver === 'undefined') {
            window.addEventListener('resize', measureTruncation);
            return () => {
                window.cancelAnimationFrame(rafId);
                window.removeEventListener('resize', measureTruncation);
            };
        }

        const observer = new ResizeObserver(measureTruncation);
        observer.observe(element);
        if (element.parentElement) {
            observer.observe(element.parentElement);
        }

        return () => {
            window.cancelAnimationFrame(rafId);
            observer.disconnect();
        };
    }, [text, measureTruncation]);

    return (
        <Tooltip title={text} arrow disableHoverListener={!isTruncated} enterDelay={0} enterNextDelay={0}>
            <Box
                component="span"
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    width: '100%',
                    minWidth: 0,
                    minHeight: '2.5em',
                }}
            >
                <Box
                    component="span"
                    ref={textRef}
                    sx={{
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        lineHeight: 1.25,
                        maxHeight: '2.5em',
                        wordBreak: 'break-word',
                    }}
                >
                    {text}
                </Box>
            </Box>
        </Tooltip>
    );
}

function RecordTrend() {
    const { recordsWithLive: records } = useRecords();
    const { excludedGroupIds } = useGroups();
    const { excludedActivityIds } = useActivities();
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { filterState } = useFilter();
    const { groupFilter, tagFilter } = filterState;
    const [groupBy, setGroupBy] = useLocalStorageState('trend.groupBy', 'activity');
    const [selectedPeriod, setSelectedPeriod] = useLocalStorageState('trend.selectedPeriod', '30day');
    const [settingsOpen, setSettingsOpen] = useLocalStorageState('trend.settingsOpen', false);
    const [rowsPerPage, setRowsPerPage] = useLocalStorageState('trend.rowsPerPage', 10);
    const [incPage, setIncPage] = useState(0);
    const [decPage, setDecPage] = useState(0);

    const visibleRecords = useMemo(() => {
        return records.filter(r => {
            if (r.activity_group_id === null || r.activity_group_id === undefined) return true;
            if (groupFilter && r.activity_group === groupFilter) return true;
            return !excludedGroupIds.has(Number(r.activity_group_id));
        });
    }, [records, excludedGroupIds, groupFilter]);

    const visibleRecordsByActivity = useMemo(() => {
        return visibleRecords.filter(r => {
            if (r.activity_id === null || r.activity_id === undefined) return true;
            return !excludedActivityIds.has(Number(r.activity_id));
        });
    }, [visibleRecords, excludedActivityIds]);

    const filteredRecords = useMemo(() => {
        return visibleRecordsByActivity.filter(r => {
            if (groupFilter && r.activity_group !== groupFilter) return false;
            if (tagFilter) {
                const tagNames = r.tags ? r.tags.map(t => t.name) : [];
                if (!tagNames.includes(tagFilter)) return false;
            }
            return true;
        });
    }, [visibleRecordsByActivity, groupFilter, tagFilter]);

    const grouped = useMemo(() => groupRecords(filteredRecords, groupBy), [filteredRecords, groupBy]);
    const increase = useMemo(() => sortIncrease(grouped, selectedPeriod), [grouped, selectedPeriod]);
    const decrease = useMemo(() => sortDecrease(grouped, selectedPeriod), [grouped, selectedPeriod]);
    const paginationSx = {
        minHeight: 36,
        height: 36,
        overflowX: 'hidden',
        '& .MuiTablePagination-toolbar': {
            minHeight: 36,
            height: 36,
            px: 0.5,
            overflow: 'hidden',
            justifyContent: 'flex-end',
        },
        '& .MuiTablePagination-spacer': {
            display: 'none',
        },
        '& .MuiTablePagination-selectLabel': {
            display: 'none',
        },
        '& .MuiTablePagination-input': {
            display: 'none',
        },
        '& .MuiTablePagination-displayedRows': {
            margin: 0,
            whiteSpace: 'nowrap',
            fontSize: '0.75rem',
        },
        '& .MuiTablePagination-actions': {
            marginLeft: 0.5,
        },
        '& .MuiTablePagination-actions .MuiIconButton-root': {
            p: 0.5,
        },
    };

    const incRows = increase.slice(incPage * rowsPerPage, incPage * rowsPerPage + rowsPerPage);
    const decRows = decrease.slice(decPage * rowsPerPage, decPage * rowsPerPage + rowsPerPage);

    useEffect(() => {
        const maxIncPage = Math.max(0, Math.ceil(increase.length / rowsPerPage) - 1);
        const maxDecPage = Math.max(0, Math.ceil(decrease.length / rowsPerPage) - 1);
        if (incPage > maxIncPage) setIncPage(maxIncPage);
        if (decPage > maxDecPage) setDecPage(maxDecPage);
    }, [increase.length, decrease.length, rowsPerPage, incPage, decPage]);

    return (
        <Box
            sx={(theme) => ({
                mb: 1,
                px: 1.25,
                py: 0.75,
                borderRadius: 1.5,
                backgroundColor:
                    theme.palette.mode === 'dark'
                        ? 'rgba(255,255,255,0.06)'
                        : 'rgba(0,0,0,0.03)',
            })}
        >
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
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
                <Button
                    size="small"
                    startIcon={<SettingsIcon fontSize="small" />}
                    sx={{ color: '#cccccc', textTransform: 'none', minWidth: 'auto', px: 0.5 }}
                    onClick={() => setSettingsOpen(prev => !prev)}
                >
                    {settingsOpen ? 'Close' : 'Open'}
                </Button>
            </Box>
            <Collapse in={uiState.trendOpen}>
                {settingsOpen && (
                    <Box sx={{ mb: 2, display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 1 }}>
                        <TextField select size='small' label='Group By' value={groupBy} onChange={e => setGroupBy(e.target.value)}>
                            <MenuItem value='activity'>Activity</MenuItem>
                            <MenuItem value='tag'>Tag</MenuItem>
                            <MenuItem value='group'>Group</MenuItem>
                        </TextField>
                        <TextField select size='small' label='Date Range' value={selectedPeriod} onChange={e => { setSelectedPeriod(e.target.value); setIncPage(0); setDecPage(0); }}>
                            <MenuItem value='30day'>30 Days</MenuItem>
                            <MenuItem value='7day'>7 Days</MenuItem>
                            <MenuItem value='7v30'>7d vs 30d</MenuItem>
                        </TextField>
                        <TextField
                            select
                            size='small'
                            label='Rows / Page'
                            value={String(rowsPerPage)}
                            onChange={e => {
                                setRowsPerPage(Number(e.target.value));
                                setIncPage(0);
                                setDecPage(0);
                            }}
                        >
                            <MenuItem value='5'>5</MenuItem>
                            <MenuItem value='10'>10</MenuItem>
                            <MenuItem value='20'>20</MenuItem>
                        </TextField>
                    </Box>
                )}
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                    <Box sx={{ flex: 1, minWidth: 320, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table
                            size='small'
                            sx={(theme) => ({
                                tableLayout: 'fixed',
                                width: '100%',
                                backgroundColor: theme.palette.mode === 'dark' ? '#222' : '#fafafa'
                            })}
                        >
                            <TableHead sx={(theme) => ({ backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)' })}>
                                <TableRow>
                                    <TableCell>Increase Ranking</TableCell>
                                    <TableCell align='center' sx={{ width: 92 }}>Total</TableCell>
                                    <TableCell align='center' sx={{ width: 92 }}>Change</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {incRows.map(row => {
                                    const diff =
                                        selectedPeriod === '7day'
                                            ? row.diff7
                                            : selectedPeriod === '30day'
                                                ? row.diff30
                                                : row.total7 - (row.total30 * 7 / 30);
                                    const total =
                                        selectedPeriod === '7day' || selectedPeriod === '7v30'
                                            ? row.total7
                                            : row.total30;
                                    const prev =
                                        selectedPeriod === '7day'
                                            ? row.prev7
                                            : selectedPeriod === '30day'
                                                ? row.prev30
                                                : row.total30 * 7 / 30;
                                    return (
                                        <TableRow key={row.name}>
                                            <TableCell sx={{ width: 'auto', verticalAlign: 'middle' }}>
                                                <TruncatedTrendName text={row.name} />
                                            </TableCell>
                                            <TableCell align='center' sx={{ width: 92 }}>
                                                {formatValue(total, row.unit)}
                                                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: -1 }}>
                                                    {formatDailyAverage(total, row.unit, selectedPeriod === '30day' ? 30 : 7)}
                                                </span>
                                            </TableCell>
                                            <TableCell
                                                align='center'
                                                sx={(theme) => ({
                                                    width: 92,
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
                            rowsPerPage={rowsPerPage}
                            rowsPerPageOptions={[rowsPerPage]}
                            labelRowsPerPage=""
                            labelDisplayedRows={({ from, to, count }) =>
                                `${from}-${to} of ${count !== -1 ? count : `${to}+`}`
                            }
                            sx={paginationSx}
                        />
                    </Box>
                    <Box sx={{ flex: 1, minWidth: 320, border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                        <Table
                            size='small'
                            sx={(theme) => ({
                                tableLayout: 'fixed',
                                width: '100%',
                                backgroundColor: theme.palette.mode === 'dark' ? '#222' : '#fafafa'
                            })}
                        >
                            <TableHead sx={(theme) => ({ backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.04)' })}>
                                <TableRow>
                                    <TableCell>Decrease Ranking</TableCell>
                                    <TableCell align='center' sx={{ width: 92 }}>Total</TableCell>
                                    <TableCell align='center' sx={{ width: 92 }}>Change</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {decRows.map(row => {
                                    const diff =
                                        selectedPeriod === '7day'
                                            ? row.diff7
                                            : selectedPeriod === '30day'
                                                ? row.diff30
                                                : row.total7 - (row.total30 * 7 / 30);
                                    const total =
                                        selectedPeriod === '7day' || selectedPeriod === '7v30'
                                            ? row.total7
                                            : row.total30;
                                    const prev =
                                        selectedPeriod === '7day'
                                            ? row.prev7
                                            : selectedPeriod === '30day'
                                                ? row.prev30
                                                : row.total30 * 7 / 30;
                                    return (
                                        <TableRow key={row.name}>
                                            <TableCell sx={{ width: 'auto', verticalAlign: 'middle' }}>
                                                <TruncatedTrendName text={row.name} />
                                            </TableCell>
                                            <TableCell align='center' sx={{ width: 92 }}>
                                                {formatValue(total, row.unit)}
                                                <span style={{ fontSize: '0.75rem', display: 'block', marginTop: -1 }}>
                                                    {formatDailyAverage(total, row.unit, selectedPeriod === '30day' ? 30 : 7)}
                                                </span>
                                            </TableCell>
                                            <TableCell
                                                align='center'
                                                sx={(theme) => ({
                                                    width: 92,
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
                            rowsPerPage={rowsPerPage}
                            rowsPerPageOptions={[rowsPerPage]}
                            labelRowsPerPage=""
                            labelDisplayedRows={({ from, to, count }) =>
                                `${from}-${to} of ${count !== -1 ? count : `${to}+`}`
                            }
                            sx={paginationSx}
                        />
                    </Box>
                </Box>
            </Collapse>
        </Box>
    );
}

export default RecordTrend;
