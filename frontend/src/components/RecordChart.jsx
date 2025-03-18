// frontend/src/components/RecordChart.jsx
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Box,
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    Collapse
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
import { useActivities } from '../contexts/ActivityContext';
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
function aggregateRecords(records, xAxisUnit, groupBy, aggregationUnit) {
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

    return dataArray;
}

function RecordChart() {
    // コンテキストから必要なデータを取得
    const { records } = useRecords();
    const { groups } = useGroups();
    const { filterState } = useFilter();
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { state: recordListState, dispatch: recordListDispatch } = useRecordListState();

    // チャート表示用の各種状態
    const [chartType, setChartType] = useState('line'); // 'line' または 'bar'
    const [xAxisUnit, setXAxisUnit] = useState('day'); // 'day' / 'week' / 'month'
    const [groupBy, setGroupBy] = useState('group'); // 'group' / 'tag' / 'activity'
    // 集計単位（"time" または "count"）の状態。自動判定と手動切替の両方をサポート
    const [aggregationUnit, setAggregationUnit] = useState('time');
    const [isAggregationManual, setIsAggregationManual] = useState(false);
    // フィルタ条件を反映して表示に使うレコードをフィルタ
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filterState.groupFilter && r.activity_group !== filterState.groupFilter) return false;
            if (filterState.tagFilter) {
                const tagNames = r.tags ? r.tags.map(t => t.name) : [];
                if (!tagNames.includes(filterState.tagFilter)) return false;
            }
            if (filterState.activityNameFilter && r.activity_name !== filterState.activityNameFilter) return false;
            return true;
        });
    }, [records, filterState]);
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
        return aggregateRecords(filteredRecords, xAxisUnit, groupBy, aggregationUnit);
    }, [filteredRecords, xAxisUnit, groupBy, aggregationUnit]);

    // グラフ描画に使う色パレット
    const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff7300', '#413ea0', '#ff0000', '#00ff00', '#0000ff'];

    // aggregationUnitに応じて数値をフォーマットする
    const formatTimeValue = (value) => {
        const roundedValue = Math.round(value);
        if (aggregationUnit === 'time') {
            const hours = Math.floor(roundedValue / 60);
            const minutes = Math.round(roundedValue % 60);
            return `${hours}時間${minutes}分`;
        }
        return value;
    };
    const formatTimeValueHour = (value) => {
        const roundedValue = Math.round(value);
        if (aggregationUnit === 'time') {
            const hours = Math.floor(roundedValue / 60);
            return `${hours}時間`;
        }
        return value;
    };
    // 月日の表示のフォーマッタ
    const xAxisTickFormatter = (dateStr) => {
        if (xAxisUnit === 'month') {
            // chartData の periodKey は "yyyy-MM" の形式になっているので
            const dt = DateTime.fromFormat(dateStr, "yyyy-MM");
            return dt.isValid ? `${dt.month}月` : dateStr;
        } else {
            // "day" の場合は "yyyy-MM-dd"、"week" の場合は "yyyy-'W'WW" となっているので、それぞれパースする
            let dt;
            if (xAxisUnit === 'day') {
                dt = DateTime.fromFormat(dateStr, "yyyy-MM-dd");
            } else if (xAxisUnit === 'week') {
                // 週の場合、Luxon で直接 "kkkk-'W'WW" から変換する
                dt = DateTime.fromFormat(dateStr, "kkkk-'W'WW");
            }
            if (dt && dt.isValid) {
                return `${dt.month}月${dt.day}日`;
            }
            return dateStr;
        }
    };

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
                    {/* チャート種類の切替 */}
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, justifyContent: 'flex-end' }}>
                        <ToggleButtonGroup
                            value={chartType}
                            exclusive
                            onChange={(e, newType) => { if (newType !== null) setChartType(newType); }}
                            aria-label="Chart Type"
                            size='small'
                        >
                            <ToggleButton value="line" aria-label="Line Chart">
                                Line
                            </ToggleButton>
                            <ToggleButton value="bar" aria-label="Bar Chart">
                                Bar
                            </ToggleButton>
                        </ToggleButtonGroup>
                        {/* x軸の集計単位切替 */}
                        <ToggleButtonGroup
                            value={xAxisUnit}
                            exclusive
                            onChange={(e, newUnit) => { if (newUnit !== null) setXAxisUnit(newUnit); }}
                            aria-label="X-Axis Unit"
                            size='small'
                        >
                            <ToggleButton value="day" aria-label="Daily">
                                Day
                            </ToggleButton>
                            <ToggleButton value="week" aria-label="Weekly">
                                Week
                            </ToggleButton>
                            <ToggleButton value="month" aria-label="Monthly">
                                Month
                            </ToggleButton>
                        </ToggleButtonGroup>
                        {/* グループ化モード切替 */}
                        <ToggleButtonGroup
                            value={groupBy}
                            exclusive
                            onChange={(e, newGroupBy) => { if (newGroupBy !== null) setGroupBy(newGroupBy); }}
                            aria-label="Grouping Mode"
                            size='small'
                        >
                            <ToggleButton value="group" aria-label="Group">
                                Group
                            </ToggleButton>
                            <ToggleButton value="tag" aria-label="Tag">
                                Tag
                            </ToggleButton>
                            <ToggleButton value="activity" aria-label="Activity">
                                Activity
                            </ToggleButton>
                        </ToggleButtonGroup>
                        {/* 集計単位の手動切替 */}
                        <ToggleButtonGroup
                            value={aggregationUnit}
                            exclusive
                            onChange={(e, newAggUnit) => {
                                if (newAggUnit !== null) {
                                    setAggregationUnit(newAggUnit);
                                    setIsAggregationManual(true);
                                }
                            }}
                            aria-label="Aggregation Unit"
                            size='small'
                        >
                            <ToggleButton value="time" aria-label="Time">
                                Time
                            </ToggleButton>
                            <ToggleButton value="count" aria-label="Count">
                                Count
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                </Box>
                {/* チャート描画部 */}
                <ResponsiveContainer width="100%" height={400}>
                    {chartType === 'line' ? (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={xAxisTickFormatter} />
                            <YAxis domain={[0, 'auto']} tickFormatter={formatTimeValueHour} />
                            <Tooltip
                                formatter={(value) => formatTimeValue(value)}
                                contentStyle={{
                                    backgroundColor: theme.palette.mode === 'dark' ? '#000' : '#fff',
                                    border: 'none'
                                }}
                                labelStyle={{
                                    color: theme.palette.mode === 'dark' ? '#fff' : '#000'
                                }}
                            />                            <Legend />
                            {Object.keys(chartData[0] || {})
                                .filter(key => key !== 'date')
                                .map((key, index) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={colorScale(key)}
                                        dot={{ r: 3 }}
                                    />
                                ))}
                        </LineChart>
                    ) : (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" tickFormatter={xAxisTickFormatter} />
                            <YAxis domain={[0, 'auto']} tickFormatter={formatTimeValueHour} />
                            <Tooltip
                                formatter={(value) => formatTimeValue(value)}
                                contentStyle={{
                                    backgroundColor: theme.palette.mode === 'dark' ? '#000' : '#fff',
                                    border: 'none'
                                }}
                                labelStyle={{
                                    color: theme.palette.mode === 'dark' ? '#fff' : '#000'
                                }}
                            />                            <Legend />
                            {Object.keys(chartData[0] || {})
                                .filter(key => key !== 'date')
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