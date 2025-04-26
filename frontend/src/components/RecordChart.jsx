import React, { useEffect, useMemo, useCallback, useState } from 'react';
import useLocalStorageState from '../hooks/useLocalStorageState';
import {
    Box,
    Typography,
    Collapse,
    TextField,
    MenuItem,
    IconButton
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
    Legend,
    Customized
} from 'recharts';
import { forceSimulation, forceY, forceCollide } from 'd3-force';
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
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

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
        const dt = DateTime.fromISO(record.created_at, { zone: 'utc' }).toLocal();
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
        } else if (groupBy === 'activityMemo') {
            // Activity 名と memo を連結して 1 つのキーにする
            const memoPart = record.memo ? ` / ${record.memo}` : '';
            groupKeys.push((record.activity_name || 'Unknown Activity') + memoPart);
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

function getPeriodRange(period, offset = 0) {
    // 期間の境界を求める
    // 今日の 00:00 を基準
    const today = DateTime.now().startOf('day');

    const PERIOD_DAYS = {
        '7d': 7,
        '30d': 30,
        '90d': 90,
        '365d': 365,
    };

    if (period in PERIOD_DAYS) {
        const days = PERIOD_DAYS[period];
        const end = today.minus({ days: days * offset });
        const start = end.minus({ days }).plus({ days: 1 });
        return [start, end];
    }
    // 'all' など期間無制限
    return [DateTime.fromMillis(0), today];
}

function RecordChart() {
    // コンテキストから必要なデータを取得
    const { records } = useRecords();
    const { groups } = useGroups();
    const { filterState } = useFilter();
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { dispatch: recordListDispatch } = useRecordListState();

    // チャート表示用の各種状態
    const [chartType, setChartType] = useLocalStorageState('chart.chartType', 'line');; // 'line' または 'bar'
    const [xAxisUnit, setXAxisUnit] = useLocalStorageState('chart.xAxisUnit', 'day'); // 'day' / 'week' / 'month'
    const [groupBy, setGroupBy] = useLocalStorageState('chart.groupBy', 'group'); // 'group' / 'tag' / 'activity'
    // 集計単位（"time" または "count"）の状態。自動判定と手動切替の両方をサポート
    const [aggregationUnit, setAggregationUnit] = useLocalStorageState('chart.aggregationUnit', 'time');
    const [isAggregationManual, setIsAggregationManual] = useLocalStorageState('chart.aggregationManual', false);
    // 集計期間
    const [selectedPeriod, setSelectedPeriod] = useLocalStorageState('chart.selectedPeriod', '30d'); // デフォルトは過去30日
    const [offset, setOffset] = useState(0); // ページング用オフセット
    const [periodStart, periodEnd] = useMemo(
        () => getPeriodRange(selectedPeriod, offset),
        [selectedPeriod, offset]
    );

    // フィルタ条件を反映して表示に使うレコードをフィルタ
    const filteredRecords = useMemo(() => {
        const [start, end] = getPeriodRange(selectedPeriod, offset);
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
            const rd = DateTime.fromISO(r.created_at);
            return rd >= start && rd <= end.endOf('day');
        });
    }, [records, filterState, selectedPeriod, offset]);
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
    const tooltipValueFormatter = (value) => {
        const roundedValue = Math.round(value);
        if (aggregationUnit === 'time') {
            const hours = Math.floor(roundedValue / 60);
            const minutes = String(Math.round(roundedValue % 60)).padStart(2, '0');
            return `${hours}時間${minutes}分`;
        }
        return value;
    };
    // y軸表示のフォーマット
    const yAxisTimeValueFormatter = (value) => {
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
                if (key !== 'date' && key !== 'date') allKeys.add(key);
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

    // Line Chartのラベル関連
    // 最も長いラベルの幅を計算する
    const longestLabelWidth = useMemo(() => {
        if (!keys || keys.length === 0) return 0; // fallback（初回表示時はkeysが空のため）

        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.font = '12px sans-serif';

        return Math.max(...keys.map(k => ctx.measureText(k).width)) + 12;
    }, [chartData]);

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
                            {tooltipValueFormatter(entry.value)}
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
                            label="Date Range"
                            size="small"
                            value={selectedPeriod}
                            onChange={(e) => {
                                setSelectedPeriod(e.target.value);
                                setOffset(0);
                            }}
                            sx={{ minWidth: 120 }}
                        >
                            <MenuItem value="all">All</MenuItem>
                            <MenuItem value="365d">365 Days</MenuItem>
                            <MenuItem value="30d">30 Days</MenuItem>
                            <MenuItem value="7d">7 Days</MenuItem>
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
                            label="Interval"
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
                            <MenuItem value="activityMemo">Activity + Memo</MenuItem>
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
                {/* 表示期間切り替えUI */}
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 0.5 }}>
                    {/* 本日ボタン（オフセットをリセットする） */}
                    <IconButton
                        onClick={() => setOffset(0)}
                        size='small'
                        sx={{
                            borderRadius: 8,
                            padding: '12px'
                        }}
                    >
                        <span style={{ fontSize: '1rem' }}>Today</span>
                    </IconButton>
                    {/* 前へ */}
                    <IconButton onClick={() => setOffset(o => o + 1)}>
                        <ChevronLeftIcon />
                    </IconButton>
                    {/* 次へ（最新期間より先には進まない） */}
                    <IconButton
                        onClick={() => setOffset(o => Math.max(o - 1, 0))}
                        disabled={offset === 0}
                    >
                        <ChevronRightIcon />
                    </IconButton>
                    {/* 表示中の範囲 */}
                    <Typography variant="subtitle1" sx={{ mx: 0 }}>
                        {periodStart.toFormat('yyyy-LL-dd')} – {periodEnd.toFormat('yyyy-LL-dd')}
                    </Typography>
                </Box>
                {/* チャート描画部 */}
                {chartData.length === 0 ? (
                    /* ----- データが無い場合の表示 ----- */
                    <Box
                        sx={{
                            height: 250,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: 1,
                            color: theme.palette.text.disabled,
                            backgroundColor: theme.palette.mode === 'dark'
                                ? '#222'
                                : '#fafafa',
                        }}
                    >
                        <Typography variant="subtitle2">
                            No data in this period
                        </Typography>
                    </Box>
                ) : (
                    <ResponsiveContainer width="100%" height={250}>
                        {chartType === 'line' ? (
                            <LineChart data={chartData} margin={{ left: 25, right: longestLabelWidth }}>
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
                                    tickFormatter={yAxisTimeValueFormatter}
                                    domain={[0, dataMax => dataMax < 120 ? Math.ceil(dataMax / 5) * 5 : Math.ceil(dataMax / 60) * 60]}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                {/* カスタムラベル */}
                                <Customized
                                    component={({ xAxisMap, yAxisMap }) => {
                                        const xKey = Object.keys(xAxisMap)[0];
                                        const yKey = Object.keys(yAxisMap)[0];
                                        const xScale = xAxisMap[xKey]?.scale;
                                        const yScale = yAxisMap[yKey]?.scale;

                                        if (!xScale || !yScale) return null;

                                        const labels = keys.map(key => {
                                            const last = chartData[chartData.length - 1];

                                            return {
                                                key,
                                                value: last[key],
                                                rawX: xScale(last.dateValue),
                                                rawY: yScale(last[key]),
                                                y: yScale(last[key]), // 初期y
                                                color: colorScale(key),
                                            };
                                        });

                                        // 右端の凡例がなるべく重ならないようにする
                                        const topPadding = 10;
                                        const bottomPadding = 30;
                                        const chartHeight = 250;
                                        const availableHeight = chartHeight - topPadding - bottomPadding;
                                        const minGap = 10;
                                        labels.sort((a, b) => a.rawY - b.rawY);
                                        // d3-forceによる重なり回避
                                        const sim = forceSimulation(labels)
                                            .force('y', forceY(d => d.rawY).strength(1))
                                            .force('collide', forceCollide(minGap / 2))
                                            .stop();
                                        for (let i = 0; i < 300; ++i) sim.tick();

                                        // 手動調整で順序を保つ（必要に応じて）
                                        for (let i = 1; i < labels.length; ++i) {
                                            const prev = labels[i - 1];
                                            const curr = labels[i];
                                            if (curr.y - prev.y < minGap) {
                                                curr.y = prev.y + minGap;
                                            }
                                        }

                                        // スケーリング or シフト
                                        const validYLabels = labels.filter(
                                            l => typeof l.y === 'number' &&
                                                !isNaN(l.y) &&
                                                l.key !== 'date' &&
                                                l.key !== 'dateValue'
                                        );

                                        if (validYLabels.length === 0) return;

                                        const yMin = Math.min(...validYLabels.map(l => l.y));
                                        const yMax = Math.max(...validYLabels.map(l => l.y));
                                        const labelSpan = yMax - yMin;

                                        if (labelSpan > availableHeight) {
                                            // スケーリングして詰める
                                            const scale = availableHeight / labelSpan;
                                            labels.forEach(label => {
                                                label.y = topPadding + (label.y - yMin) * scale;
                                            });
                                        } else {
                                            // シフトして中央寄せ（または上寄せ）
                                            const offset = topPadding - yMin;
                                            labels.forEach(label => {
                                                label.y += offset;
                                            });
                                        }

                                        return (
                                            <g>
                                                {labels.map(label => (
                                                    <g key={`label-${label.key}`}>
                                                        {/* ガイドライン: 折れ線の終点 → ラベル */}
                                                        <line
                                                            x1={label.rawX}
                                                            y1={label.rawY}
                                                            x2={label.rawX + 10}
                                                            y2={label.y}
                                                            stroke={label.color}
                                                            strokeWidth={.5}
                                                        />
                                                        {/* ラベル */}
                                                        <text
                                                            x={label.rawX + 10}
                                                            y={label.y}
                                                            fill={label.color}
                                                            fontSize={12}
                                                            alignmentBaseline="middle"
                                                            textAnchor="start"
                                                        >
                                                            {label.key}
                                                        </text>
                                                    </g>
                                                ))}
                                            </g>
                                        );
                                    }}
                                />
                                {Object.keys(chartData[0] || {})
                                    .filter(key => key !== 'date')
                                    .filter(key => key !== 'dateValue')
                                    .map((key, index) => (
                                        <Line
                                            key={key}
                                            type="stepAfter"
                                            dataKey={key}
                                            stroke={colorScale(key)}
                                            dot={false}
                                        />
                                    ))}
                            </LineChart>
                        ) : (
                            <BarChart data={chartData} margin={{ left: 20 }} >
                                <CartesianGrid
                                    stroke={theme.palette.mode === 'dark' ? '#222' : '#eee'}
                                />
                                <XAxis
                                    type='number'
                                    dataKey='dateValue'
                                    scale='time'
                                    domain={[ // 半日分広げる
                                        (dataMin) => dataMin - 86400000 / 2,
                                        (dataMax) => dataMax + 86400000 / 2
                                    ]}
                                    tickFormatter={xAxisTickFormatter}
                                />
                                <YAxis
                                    tickCount={8}
                                    tickFormatter={yAxisTimeValueFormatter}
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
                )}
            </Collapse>
        </Box>
    );
}

export default RecordChart;