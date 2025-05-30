import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Box,
    MenuItem,
    Typography,
    Collapse,
    TextField
} from '@mui/material';
import ActivityCalendar from 'react-activity-calendar'
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { format } from 'date-fns';
import { DateTime } from 'luxon';
import RecordFilter from './RecordFilter';
import useRecordListState from '../hooks/useRecordListState';
import { useGroups } from '../contexts/GroupContext';
import { useActiveActivity } from '../contexts/ActiveActivityContext';
import KeyboardArrowRightIcon from '@mui/icons-material/KeyboardArrowRight';
import { useUI } from '../contexts/UIContext';
import { useRecords } from '../contexts/RecordContext';
import { useMediaQuery, useTheme } from '@mui/material';

function RecordHeatmap() {
    const [displayMode, setDisplayMode] = useState('time');
    const [heatmapData, setHeatmapData] = useState([]);
    const { state: recordListState, dispatch: recordListDispatch } = useRecordListState();
    const { filterCriteria } = recordListState;
    const { groups } = useGroups();
    const { activeActivity } = useActiveActivity();
    const [filteredRecords, setFilteredRecords] = useState([]);
    const { state: uiState, dispatch: uiDispatch } = useUI();
    const { records } = useRecords();
    const { palette: { mode } } = useTheme();

    const handleFilterChange = useCallback((newCriteria) => {
        recordListDispatch({ type: 'SET_FILTER_CRITERIA', payload: newCriteria });
    }, [recordListDispatch]);

    // filterCriteria に応じて records をフィルタリングする
    useEffect(() => {
        const { groupFilter, tagFilter, activityNameFilter } = filterCriteria;
        let filtered = records.filter((record) => {
            const groupMatch = groupFilter ? record.activity_group === groupFilter : true;
            const tagMatch = tagFilter
                ? record.tags && record.tags.some(tag => tag.name === tagFilter)
                : true;
            const nameMatch = activityNameFilter
                ? record.activity_name.toLowerCase() === activityNameFilter.toLowerCase()
                : true;
            return groupMatch && tagMatch && nameMatch;
        });
        setFilteredRecords(filtered);
    }, [filterCriteria, records, activeActivity]);

    // フィルター条件が変化するたびに件数の多い単位を選ぶ
    useEffect(() => {
        let countMinutes = 0, countCount = 0;
        filteredRecords.forEach(rec => {
            if (rec.unit === 'minutes') countMinutes++;
            else if (rec.unit === 'count') countCount++;
        });
        // 同数の場合は "time" を採用
        const aggregationUnit = countMinutes >= countCount ? 'time' : 'count';
        setDisplayMode(aggregationUnit);
    }, [filteredRecords]);

    useEffect(() => {
        // 過去365日分に絞り込む
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 365);
        const recentRecords = filteredRecords.filter(rec => new Date(rec.created_at) >= cutoff);

        // 日別にレコードを集計する
        const grouped = {};
        recentRecords.forEach(rec => {
            const dateStr = DateTime
                .fromISO(rec.created_at, { zone: 'utc' })
                .toLocal()
                .toFormat('yyyy-MM-dd');
            if (!grouped[dateStr]) {
                grouped[dateStr] = 0;
            }
            // displayMode に応じた集計処理
            if (displayMode === 'time') {
                // 時間モード: アクティビティの記録単位が「分」のものだけを採用
                if (rec.unit === 'minutes') {
                    // 分の合計を加算
                    grouped[dateStr] += rec.value;
                }
            } else if (displayMode === 'count') {
                // 回数モード:
                if (rec.unit === 'count') {
                    // 「回」の場合はそのまま加算
                    grouped[dateStr] += rec.value;
                } else if (rec.unit === 'minutes') {
                    // 「分」の場合は1として加算
                    grouped[dateStr] += 1;
                }
            }
        });

        // 過去365日分の全日付を生成する
        const endDate = new Date(); // 今日
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 365);
        const allDates = [];
        for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
            allDates.push(format(new Date(d), 'yyyy-MM-dd'));
        }

        // すべての日付にcountを設定
        const dataArr = allDates.map(date => ({
            date,
            count: grouped[date] || 0
        }));


        // 全体の中での最大値を取得
        const maxCount = Math.max(...dataArr.map(item => item.count), 0);
        const maxLevel = 4; // level: 0 ～ 4

        // 各データに count に応じた level を割り当てる
        const dataWithLevel = dataArr.map(item => {
            let level = 0;
            if (maxCount > 0) {
                level = Math.floor((item.count / maxCount) * maxLevel);
                // 0 でないなら最低 level を 1 にする（必要に応じて）
                if (item.count > 0 && level === 0) {
                    level = 1;
                }
            }
            return { ...item, level };
        });
        setHeatmapData(dataWithLevel);
    }, [filteredRecords, displayMode]);

    // heatmapData 全体の count 合計を算出
    const totalCount = heatmapData.reduce((sum, item) => sum + item.count, 0);

    // 過去30日分、過去7日分の合計を計算する
    const now = new Date();
    const past30 = new Date(now);
    past30.setDate(now.getDate() - 30);
    const past7 = new Date(now);
    past7.setDate(now.getDate() - 7);

    const totalCount30 = heatmapData.reduce((sum, item) => {
        const itemDate = new Date(item.date);
        return itemDate >= past30 ? sum + item.count : sum;
    }, 0);

    const totalCount7 = heatmapData.reduce((sum, item) => {
        const itemDate = new Date(item.date);
        return itemDate >= past7 ? sum + item.count : sum;
    }, 0);

    // displayMode に応じた表示フォーマット
    const totalCountLabel =
        displayMode === 'time'
            ? `${Math.floor(totalCount / 60)} h / year`
            : `${totalCount.toFixed(0)} times / year`;

    const totalCountLabel30 =
        displayMode === 'time'
            ? `${Math.floor(totalCount30 / 60)} h / 30d`
            : `${totalCount30.toFixed(0)} times / 30d`;

    const totalCountLabel7 =
        displayMode === 'time'
            ? `${Math.floor(totalCount7 / 60)}:${String((totalCount7 % 60).toFixed(0)).padStart(2, '0')} / 7d`
            : `${totalCount7.toFixed(0)} times / 7d`;

    // min-width:1100px であるかどうかを判定
    const isWide = useMediaQuery('(min-width:1100px)');
    const blockSize = isWide ? 15 : 12;

    return (
        <Box sx={{ mb: 1 }}>
            <Typography
                variant='caption'
                color='#cccccc'
                sx={{ alignItems: 'center', display: 'flex', cursor: 'pointer' }}
                onClick={() => uiDispatch({ type: 'SET_HEATMAP_OPEN', payload: !uiState.heatmapOpen })}
            >
                Heatmap
                <KeyboardArrowRightIcon
                    fontSize='small'
                    sx={{
                        transition: 'transform 0.15s linear',
                        transform: uiState.heatmapOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                        marginLeft: '4px'
                    }}
                />
            </Typography>
            <Collapse in={uiState.heatmapOpen}>
                {heatmapData.length > 0 ? (
                    <Box sx={{ mb: 2 }}>
                        <Box sx={{ mb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <RecordFilter
                                groups={groups}
                                onFilterChange={handleFilterChange}
                                records={records}
                            />
                            <TextField
                                value={displayMode}
                                select
                                onChange={(e) => setDisplayMode(e.target.value)}
                                label="Unit"
                                size='small'
                            >
                                <MenuItem value="time">Time</MenuItem>
                                <MenuItem value="count">Count</MenuItem>
                            </TextField>
                        </Box>
                        <ActivityCalendar
                            data={heatmapData}
                            blockSize={blockSize}
                            blockMargin={2}
                            fontSize={14}
                            colorScheme={mode}
                            theme={{
                                light: ["#f0f0f0", "#c6e48b", "#7bc96f", "#239a3b", "#196127"],
                                dark: ["#161b22", "#1b3a2d", "#236b3a", "#2a9d47", "#33cf54"]
                            }}
                            hideMonthLabels={false}
                            showWeekdayLabels={["Mon", "Wed", "Fri"]}
                            labels={{
                                legend: {
                                    less: "少",
                                    more: "多"
                                },
                                totalCount: `${totalCountLabel}　${totalCountLabel30}　${totalCountLabel7}`
                            }}
                            renderBlock={(block, activity) => {
                                let tooltipText;
                                if (displayMode === 'time') {
                                    const totalMinutes = Number(activity.count);
                                    const hours = Math.floor(totalMinutes / 60);
                                    const minutes = String(Math.round(totalMinutes % 60)).padStart(2, '0');
                                    tooltipText = `${hours}:${minutes} on ${activity.date}`;
                                } else {
                                    tooltipText = `${Number(activity.count).toFixed(0)} times on ${activity.date}`;
                                }
                                return React.cloneElement(block, {
                                    'data-tooltip-id': 'react-tooltip',
                                    'data-tooltip-html': tooltipText
                                });
                            }}
                        />
                        <ReactTooltip id="react-tooltip" />
                    </Box>
                ) : (
                    <Box>表示する記録データがありません。</Box>
                )}
            </Collapse>
        </Box>
    );
}

export default RecordHeatmap;