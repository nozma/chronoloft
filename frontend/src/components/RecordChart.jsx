// frontend/src/components/RecordChart.jsx
import React, { useState, useEffect, useMemo } from 'react';
import {
    Box,
    Typography,
    ToggleButtonGroup,
    ToggleButton,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Collapse
} from '@mui/material';
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
import { useGroups } from '../contexts/GroupContext';
import { useUI } from '../contexts/UIContext';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';

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
    const { filterState } = useFilter();
    const { activities } = useActivities();
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { groups } = useGroups();

    // チャート表示用の各種状態
    const [chartType, setChartType] = useState('line'); // 'line' または 'bar'
    const [xAxisUnit, setXAxisUnit] = useState('day'); // 'day' / 'week' / 'month'
    const [groupBy, setGroupBy] = useState('group'); // 'group' / 'tag' / 'activity'
    // このコンポーネント独自の Activity フィルター（activityFilter には activity.id を保持）
    const [activityFilter, setActivityFilter] = useState('');
    // 集計単位（"time" または "count"）の状態。自動判定と手動切替の両方をサポート
    const [aggregationUnit, setAggregationUnit] = useState('time');
    const [isAggregationManual, setIsAggregationManual] = useState(false);

    // 既存のフィルター条件（groupFilter, tagFilter, activityNameFilter）に加え、activityFilter を適用
    const filteredRecords = useMemo(() => {
        return records.filter(r => {
            if (filterState.groupFilter && r.activity_group !== filterState.groupFilter) return false;
            if (filterState.tagFilter) {
                const tagNames = r.tags ? r.tags.map(t => t.name) : [];
                if (!tagNames.includes(filterState.tagFilter)) return false;
            }
            if (filterState.activityNameFilter && r.activity_name !== filterState.activityNameFilter) return false;
            if (activityFilter && r.activity_id !== activityFilter) return false;
            return true;
        });
    }, [records, filterState, activityFilter]);

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

    return (
        <Box sx={{ p: 2 }}>
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
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, mb: 2 }}>
                    {/* チャート種類の切替 */}
                    <ToggleButtonGroup
                        value={chartType}
                        exclusive
                        onChange={(e, newType) => { if (newType !== null) setChartType(newType); }}
                        aria-label="Chart Type"
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
                    >
                        <ToggleButton value="time" aria-label="Time">
                            Time
                        </ToggleButton>
                        <ToggleButton value="count" aria-label="Count">
                            Count
                        </ToggleButton>
                    </ToggleButtonGroup>
                    {/* Activity フィルター */}
                    <FormControl sx={{ minWidth: 120 }}>
                        <InputLabel id="activity-filter-label">Activity</InputLabel>
                        <Select
                            labelId="activity-filter-label"
                            value={activityFilter}
                            label="Activity"
                            onChange={(e) => setActivityFilter(e.target.value)}
                        >
                            <MenuItem value="">
                                <em>All</em>
                            </MenuItem>
                            {activities.map(activity => (
                                <MenuItem key={activity.id} value={activity.id}>
                                    {activity.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                {/* チャート描画部 */}
                <ResponsiveContainer width="100%" height={400}>
                    {chartType === 'line' ? (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 'auto']} tickFormatter={formatTimeValueHour} />
                            <Tooltip formatter={(value) => formatTimeValue(value)} />
                            <Legend />
                            {Object.keys(chartData[0] || {})
                                .filter(key => key !== 'date')
                                .map((key, index) => (
                                    <Line
                                        key={key}
                                        type="monotone"
                                        dataKey={key}
                                        stroke={colors[index % colors.length]}
                                        dot={{ r: 3 }}
                                    />
                                ))}
                        </LineChart>
                    ) : (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis domain={[0, 'auto']} tickFormatter={formatTimeValueHour} />
                            <Tooltip formatter={(value) => formatTimeValue(value)} />
                            <Legend />
                            {Object.keys(chartData[0] || {})
                                .filter(key => key !== 'date')
                                .map((key, index) => (
                                    <Bar key={key} dataKey={key} stackId="a" fill={colors[index % colors.length]} />
                                ))}
                        </BarChart>
                    )}
                </ResponsiveContainer>
            </Collapse>
        </Box>
    );
}

export default RecordChart;