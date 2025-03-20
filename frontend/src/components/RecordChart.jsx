// frontend/src/components/RecordChart.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    Collapse,
    TextField,
    MenuItem
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend
} from 'recharts';
import { DateTime } from 'luxon';
import { useRecords } from '../contexts/RecordContext';
import { useFilter } from '../contexts/FilterContext';
import { useUI } from '../contexts/UIContext';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { scaleOrdinal } from 'd3-scale';
import { schemeSet3, schemeCategory10 } from 'd3-scale-chromatic';
import RecordFilter from './RecordFilter';
import useRecordListState from '../hooks/useRecordListState';
import { useGroups } from '../contexts/GroupContext';

/**
 * 指定された records を xAxisUnit, groupBy, aggregationUnit に従って集計する
 * @param {Array} records - フィルタ済みレコード群
 * @param {string} xAxisUnit - 'day' | 'week' | 'month'
 * @param {string} groupBy - 'group' | 'tag' | 'activity'
 * @param {string} aggregationUnit - 'time'（＝minutes）または 'count'
 * @returns {Array} - 集計済みデータの配列。各オブジェクトは { date: 'YYYY-MM-DD', group1: value, group2: value, ... } の形式
 */
function aggregateRecords(records, xAxisUnit, groupBy, aggregationUnit, isCumulative) {
    // aggregationUnit に合わせて対象レコードを絞る
    const filtered = records.filter(r => {
        if (aggregationUnit === 'time') {
            return r.unit === 'minutes';
        } else if (aggregationUnit === 'count') {
            // 「回」モードの場合は、minutes のレコードも含む
            return r.unit === 'count' || r.unit === 'minutes';
        }
        return false;
    });

    const dataMap = new Map();
    filtered.forEach(record => {
        // Luxon を使って record.created_at から期間キーを算出
        const dt = DateTime.fromISO(record.created_at);
        let periodKey = '';
        if (xAxisUnit === 'day') {
            periodKey = dt.toFormat('yyyy-MM-dd');
        } else if (xAxisUnit === 'week') {
            periodKey = dt.toFormat("yyyy-'W'WW");
        } else if (xAxisUnit === 'month') {
            periodKey = dt.toFormat('yyyy-MM');
        }
        if (!dataMap.has(periodKey)) {
            dataMap.set(periodKey, { date: periodKey });
        }
        const bucket = dataMap.get(periodKey);
        // グループ化キーを決定
        let groupKeys = [];
        if (groupBy === 'group') {
            groupKeys.push(record.activity_group || 'Unknown Group');
        } else if (groupBy === 'activity') {
            groupKeys.push(record.activity_name || 'Unknown Activity');
        } else if (groupBy === 'tag') {
            if (record.tags && record.tags.length > 0) {
                record.tags.forEach(t => groupKeys.push(t.name));
            } else {
                groupKeys.push('No Tag');
            }
        }
        groupKeys.forEach(key => {
            if (!bucket[key]) {
                bucket[key] = 0;
            }
            if (aggregationUnit === 'time') {
                // 分モードでは record.value をそのまま加算
                bucket[key] += record.value;
            } else if (aggregationUnit === 'count') {
                // 回数モード:
                if (record.unit === 'count') {
                    // 「回」の場合はそのまま加算
                    bucket[key] += record.value;
                } else if (record.unit === 'minutes') {
                    // 「分」の場合は 1 として加算
                    bucket[key] += 1;
                }
            }
        });
    });
    const dataArray = Array.from(dataMap.values());
    dataArray.sort((a, b) => a.date.localeCompare(b.date));

    // すべての期間で現れるグループキーの全体集合を作成
    const allGroupKeys = new Set();
    dataArray.forEach(item => {
        Object.keys(item).forEach(key => {
            if (key !== 'date') {
                allGroupKeys.add(key);
            }
        });
    });

    // 各期間のデータに、存在しないグループキーがあれば 0 を補完
    dataArray.forEach(item => {
        allGroupKeys.forEach(key => {
            if (item[key] === undefined) {
                item[key] = 0;
            }
        });
    });

    // 累積データの計算 (Line Chart用)
    if (isCumulative) {
        let cumulativeSums = {};
        dataArray.forEach(item => {
            Object.keys(item).forEach(key => {
                if (key !== 'date') {
                    if (!cumulativeSums[key]) {
                        cumulativeSums[key] = 0;
                    }
                    cumulativeSums[key] += item[key];
                    item[key] = cumulativeSums[key];
                }
            });
        });
    }

    return dataArray;
}

function RecordChart() {
    // コンテキストから必要なデータを取得
    const { records } = useRecords();
    const { groups } = useGroups();
    const { filterState } = useFilter();
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { dispatch: recordListDispatch } = useRecordListState();

    // チャート表示用の各種状態
    const [chartType, setChartType] = useState('line'); // 'line' または 'bar'
    const [xAxisUnit, setXAxisUnit] = useState('day'); // 'day' / 'week' / 'month'
    const [groupBy, setGroupBy] = useState('group'); // 'group' / 'tag' / 'activity'
    // 集計単位（"time" または "count"）の状態。自動判定と手動切替の両方をサポート
    const [aggregationUnit, setAggregationUnit] = useState('time');
    const [isAggregationManual, setIsAggregationManual] = useState(false);
    // 集計期間
    const [selectedPeriod, setSelectedPeriod] = useState('30d'); // デフォルトは過去30日

    // 過去の日付を取得する関数
    const getStartDate = (period) => {
        const now = DateTime.local();
        switch (period) {
            case '7d':
                return now.minus({ days: 7 });
            case '30d':
                return now.minus({ days: 30 });
            case '365d':
                return now.minus({ days: 365 });
            case 'all':
            default:
                return DateTime.fromMillis(0); // すべてのデータを対象
        }
    };

    // フィルタ条件を反映して表示に使うレコードをフィルタ
    const filteredRecords = useMemo(() => {
        const startDate = getStartDate(selectedPeriod);
        const filteredByState = records.filter(r => {
            if (filterState.groupFilter && r.activity_group !== filterState.groupFilter) return false;
            if (filterState.tagFilter) {
                const tagNames = r.tags ? r.tags.map(t => t.name) : [];
                if (!tagNames.includes(filterState.tagFilter)) return false;
            }
            if (filterState.activityNameFilter && r.activity_name !== filterState.activityNameFilter) return false;
            return true;
        });
        return filteredByState.filter(r => {
            const recordDate = DateTime.fromISO(r.created_at);
            return recordDate >= startDate;
        });
    }, [records, filterState, selectedPeriod]);
    // グローバルなフィルタ条件を更新する
    const handleFilterChange = useCallback((newCriteria) => {
        recordListDispatch({ type: 'SET_FILTER_CRITERIA', payload: newCriteria });
    }, [recordListDispatch]);

    // 自動判定による集計単位（"time"＝分 or "count"＝回）の決定
    const autoAggregationUnit = useMemo(() => {
        let countMinutes = 0, countCount = 0;
        filteredRecords.forEach(r => {
            if (r.unit === 'minutes') countMinutes++;
            else if (r.unit === 'count') countCount++;
        });
        return countMinutes >= countCount ? 'time' : 'count';
    }, [filteredRecords]);

    // フィルタ条件が変わったとき、手動切替がなければ自動判定を反映
    useEffect(() => {
        if (!isAggregationManual) {
            setAggregationUnit(autoAggregationUnit);
        }
    }, [autoAggregationUnit, isAggregationManual]);

    // 集計済みデータの作成
    const chartData = useMemo(() => {
        const aggregated = aggregateRecords(filteredRecords, xAxisUnit, groupBy, aggregationUnit, chartType === 'line');
        // 各データに数値（timestamp）を示す dateValue を付与
        aggregated.forEach(item => {
            let dt;
            if (xAxisUnit === 'day') {
                dt = DateTime.fromFormat(item.date, 'yyyy-MM-dd');
            } else if (xAxisUnit === 'week') {
                dt = DateTime.fromFormat(item.date, "kkkk-'W'WW");
            } else if (xAxisUnit === 'month') {
                dt = DateTime.fromFormat(item.date, 'yyyy-MM');
            }
            item.dateValue = dt.isValid ? dt.toMillis() : null;
        });
        return aggregated;
    }, [filteredRecords, xAxisUnit, groupBy, aggregationUnit, chartType]);

    // データの最大値を取得
    const maxValue = useMemo(() => {
        if (!chartData || chartData.length === 0) return 0;
        let maxVal = 0;
        chartData.forEach((row) => {
            Object.keys(row).forEach((key) => {
                if (key === 'date') return; // date 以外の値を対象に最大値を計算
                if (key === 'dateValue') return;
                const val = row[key];
                if (typeof val === 'number' && val > maxVal) {
                    maxVal = val;
                }
            });
        });
        return maxVal;
    }, [chartData]);

    // ツールチップ用の数値フォーマット
    const formatTimeValue = (value) => {
        const roundedValue = Math.round(value);
        if (aggregationUnit === 'time') {
            const hours = Math.floor(roundedValue / 60);
            const minutes = Math.round(roundedValue % 60);
            return `${hours}時間${minutes}分`;
        }
        return value;
    };
    // y軸表示のフォーマット
    const formatTimeValueHour = (value) => {
        const roundedValue = Math.round(value);
        if (aggregationUnit === 'time') {
            if (maxValue < 120) return `${value}分` // 最大値が2時間未満の場合はそのまま表示する
            const hours = Math.floor(roundedValue / 60);
            return `${hours}時間`;
        }
        return value;
    };
    // 月日の表示のフォーマッタ
    const xAxisTickFormatter = (val) => {
        if (!val) return '';
        const dt = DateTime.fromMillis(val);
        if (xAxisUnit === 'month') {
            return dt.isValid ? `${dt.month}月` : '';
        } else if (xAxisUnit === 'week') {
            return dt.isValid ? dt.toFormat('M月d日') : '';
        } else {
            // day
            return dt.isValid ? dt.toFormat('M月d日') : '';
        }
    };
    // ツールチップの日時のフォーマッタ
    const tooltipLabelFormatter = (val) => {
        if (!val) return '';
        // val はミリ秒 (timestamp) 
        const dt = DateTime.fromMillis(val);
        return dt.isValid ? dt.toFormat('yyyy-MM-dd') : '';
    }

    // 配色設定
    const theme = useTheme();
    // テーマに応じたパレットを選択
    const colorArray = theme.palette.mode === 'light' ? schemeCategory10 : schemeSet3;
    // 全系列（集計グループ）のキーを算出
    const keys = useMemo(() => {
        if (chartData.length === 0) return [];
        // すべてのオブジェクトから union を作成
        const allKeys = new Set();
        chartData.forEach(item => {
            Object.keys(item).forEach(key => {
                if (key !== 'date') allKeys.add(key);
            });
        });
        return Array.from(allKeys);
    }, [chartData]);

    // d3 の ordinal scale で色を割り当てる
    const colorScale = useMemo(() => {
        return scaleOrdinal(colorArray).domain(keys);
    }, [keys, colorArray]);

    // y軸のtickは最大値が120以上なら60の倍数にする
    const domain = useMemo(() => {
        return [
            0,
            (dataMax) => {
                if (dataMax < 120) {
                    return 'auto';
                }
                return Math.ceil(dataMax / 60) * 60;
            },
        ];
    }, []);

    // ツールチップ用カスタムコンポーネント
    const CustomTooltip = ({ active, payload, label }) => {
        const theme = useTheme(); // MUIのテーマを取得
        if (!active || !payload || payload.length === 0) return null;
        // 0を除外し数値の降順でソート
        const sortedPayload = [...payload]
            .filter(entry => entry.value > 0)
            .sort((a, b) => b.value - a.value);
        return (
            <Box
                sx={{
                    backgroundColor: theme.palette.mode === 'dark' ? '#333' : '#fff',
                    color: theme.palette.mode === 'dark' ? '#fff' : '#000',
                    padding: 1,
                    borderRadius: 1,
                    boxShadow: 3,
                    border: theme.palette.mode === 'dark' ? '1px solid #444' : '1px solid #ddd',
                    minWidth: 120,
                }}
            >
                <Typography
                    variant="caption"
                    sx={{
                        fontWeight: 'bold',
                        color: theme.palette.mode === 'dark' ? '#bbb' : '#333',
                        borderBottom: '1px solid',
                        paddingBottom: 0.5,
                        display: 'block'
                    }}
                >
                    {tooltipLabelFormatter(label)}
                </Typography>
                {sortedPayload.map((entry, index) => (
                    <Box
                        key={index}
                        sx={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginTop: 0.5,
                        }}
                    >
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                                sx={{
                                    width: 12,
                                    height: 12,
                                    backgroundColor: entry.color,
                                    borderRadius: '50%',
                                }}
                            />
                            <Typography variant="body2" sx={{ fontSize: 12 }}>
                                {entry.name}
                            </Typography>
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 'bold', fontSize: 12 }}>
                            {formatTimeValue(entry.value)}
                        </Typography>
                    </Box>
                ))}
            </Box>
        );
    };



    return (
        <Box sx={{ mb: 1 }}>
            <Typography
                variant='caption'
                color='#cccccc'
                sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                onClick={() => uiDispatch({ type: 'SET_CHART_OPEN', payload: !uiState.chartOpen })}
            >
                Chart
                <KeyboardArrowRightIcon
                    fontSize='small'
                    sx={{
                        transition: 'transform 0.15s linear',
                        transform: uiState.chartOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        marginLeft: '4px'
                    }}
                />
            </Typography>
            <Collapse in={uiState.chartOpen}>
                {/* 各種コントロール */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    {/* Activity フィルター */}
                    <RecordFilter
                        groups={groups}
                        onFilterChange={handleFilterChange}
                        records={records}
                    />
                    {/* チャート表示設定 */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-end' }}>
                        {/* 表示期間選択 */}
                        <TextField
                            select
                            label="Period"
                            size="small"
                            value={selectedPeriod}
                            onChange={(e) => setSelectedPeriod(e.target.value)}
                            sx={{ minWidth: 120 }}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="365d">Year</MenuItem>
                            <MenuItem value="30d">Month</MenuItem>
                            <MenuItem value="7d">Week</MenuItem>
                        </TextField>
                        {/* 折れ線グラフ・棒グラフ切り替え */}
                        <TextField
                            select
                            label="Chart Type"
                            variant="outlined"
                            size="small"
                            value={chartType}
                            onChange={(e) => setChartType(e.target.value)}
                            sx={{ minWidth: 100 }}
                        >
                            <MenuItem value="line">Line</MenuItem>
                            <MenuItem value="bar">Bar</MenuItem>
                        </TextField>
                        {/* x軸の集計単位切替 */}
                        <TextField
                            select
                            label="Timescale"
                            size="small"
                            value={xAxisUnit}
                            onChange={(e) => setXAxisUnit(e.target.value)}
                            sx={{ minWidth: 100 }}
                        >
                            <MenuItem value="day">Day</MenuItem>
                            <MenuItem value="week">Week</MenuItem>
                            <MenuItem value="month">Month</MenuItem>
                        </TextField>
                        {/* グループ化モード切替 */}
                        <TextField
                            select
                            label="Grouping"
                            size="small"
                            value={groupBy}
                            onChange={(e) => setGroupBy(e.target.value)}
                        >
                            <MenuItem value="group">Group</MenuItem>
                            <MenuItem value="tag">Tag</MenuItem>
                            <MenuItem value="activity">Activity</MenuItem>
                        </TextField>
                        {/* 集計単位の手動切替 */}
                        <TextField
                            select
                            label="Unit"
                            size="small"
                            value={aggregationUnit}
                            onChange={(e) => {
                                setAggregationUnit(e.target.value);
                                setIsAggregationManual(true); // ここは従来のロジックを踏襲
                            }}
                        >
                            <MenuItem value="time">Time</MenuItem>
                            <MenuItem value="count">Count</MenuItem>
                        </TextField>
                    </Box>
                </Box>
                {/* チャート描画部 */}
                <ResponsiveContainer width="100%" height={180}>
                    {chartType === 'line' ? (
                        <LineChart data={chartData}>
                            <CartesianGrid
                                stroke={theme.palette.mode === 'dark' ? '#222' : '#eee'}
                            />
                            <XAxis
                                type='number'
                                dataKey='dateValue'
                                scale='time'
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={xAxisTickFormatter}
                            />
                            <YAxis
                                tickCount={8}
                                tickFormatter={formatTimeValueHour}
                                domain={[0, dataMax => dataMax < 120 ? Math.ceil(dataMax / 5) * 5 : Math.ceil(dataMax / 60) * 60]}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            {Object.keys(chartData[0] || {})
                                .filter(key => key !== 'date')
                                .filter(key => key !== 'dateValue')
                                .map((key, index) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={colorScale(key)}
                                        dot={false}
                                    />
                                ))}
                        </LineChart>
                    ) : (
                        <BarChart data={chartData}>
                            <CartesianGrid
                                stroke={theme.palette.mode === 'dark' ? '#222' : '#eee'}
                            />
                            <XAxis
                                type='number'
                                dataKey='dateValue'
                                scale='time'
                                domain={['dataMin', 'dataMax']}
                                tickFormatter={xAxisTickFormatter}
                            />
                            <YAxis
                                tickCount={8}
                                tickFormatter={formatTimeValueHour}
                                domain={[0, dataMax => dataMax < 120 ? Math.ceil(dataMax / 5) * 5 : Math.ceil(dataMax / 60) * 60]}
                            />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend />
                            {Object.keys(chartData[0] || {})
                                .filter(key => key !== 'date')
                                .filter(key => key !== 'dateValue')
                                .map((key, index) => (
                                    <Bar
                                        key={key}
                                        dataKey={key}
                                        stackId="a"
                                        fill={colorScale(key)}
                                    />
                                ))}
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </Collapse>
        </Box>
    );
}

export default RecordChart;