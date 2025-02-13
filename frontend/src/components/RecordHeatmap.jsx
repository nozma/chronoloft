import React, { useState, useEffect } from 'react';
import { Box } from '@mui/material';
import ActivityCalendar from 'react-activity-calendar'
import { Tooltip as ReactTooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';
import { format } from 'date-fns';

function RecordHeatmap({ records, unitFilter }) {
    const [heatmapData, setHeatmapData] = useState([]);

    useEffect(() => {
        // 過去365日分に絞り込む
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 365);
        const recentRecords = records.filter(rec => new Date(rec.created_at) >= cutoff);

        // 日別に集計（record.created_at を "yyyy-MM-dd" 形式に変換）
        const grouped = {};
        recentRecords.forEach(rec => {
            const dateStr = format(new Date(rec.created_at), 'yyyy-MM-dd');
            if (!grouped[dateStr]) {
                grouped[dateStr] = 0;
            }
            grouped[dateStr] += rec.value;
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
    }, [records]);

    // heatmapData 全体の count 合計を算出
    const totalCount = heatmapData.reduce((sum, item) => sum + item.count, 0);
    const totalCountLabel =
        unitFilter === 'minutes'
            ? `${Math.floor(totalCount / 60)}時間${(totalCount % 60).toFixed(0)}分 / 年`
            : `${totalCount} Activities / 年`;

    return (
        <Box sx={{ mb: 4 }}>
            {heatmapData.length > 0 ? (
                <>
                    <ActivityCalendar
                        data={heatmapData}
                        blockSize={15}
                        blockMargin={2}
                        fontSize={14}
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
                            totalCount: totalCountLabel
                        }}
                        renderBlock={(block, activity) => {
                            let tooltipText;
                            if (unitFilter === 'minutes') {
                                const totalMinutes = Number(activity.count);
                                const hours = Math.floor(totalMinutes / 60);
                                const minutes = Math.round(totalMinutes % 60);
                                tooltipText = `${hours}時間${minutes}分 on ${activity.date}`;
                            } else {
                                tooltipText = `${Number(activity.count).toFixed(0)} activities on ${activity.date}`;
                            }
                            return React.cloneElement(block, {
                                'data-tooltip-id': 'react-tooltip',
                                'data-tooltip-html': tooltipText
                            });
                        }}
                    />
                    <ReactTooltip id="react-tooltip" />
                </>
            ) : (
                <Box>表示する記録データがありません。</Box>
            )}
        </Box>
    );
}

export default RecordHeatmap;