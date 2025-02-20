import React from 'react';
import { Button, Typography, Box } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useGroups } from '../contexts/GroupContext';

function Stopwatch({ onComplete, onCancel, discordData, activityName, activityGroup }) {
    const { groups } = useGroups();
    // カスタムフック useStopwatch を利用してタイマー処理全体を管理する
    const { displayTime, isPaused, togglePause, complete, cancel } = useStopwatch(discordData, { onComplete, onCancel });

    // 時間をフォーマットする関数（元のコードと同様）
    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${hours}時間${minutes}分${seconds}秒`;
    };

    return (
        <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                {getIconForGroup(activityGroup, groups)}
                {activityName}
            </Typography>
            <Typography variant="h4">{formatTime(displayTime)}</Typography>
            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'center', gap: 2 }}>
                <Button variant="contained" onClick={togglePause}>
                    {isPaused ? 'Resume' : 'Pause'}
                </Button>
                <Button variant="contained" color="primary" onClick={complete}>
                    完了
                </Button>
                <Button variant="outlined" color="error" onClick={cancel}>
                    キャンセル
                </Button>
            </Box>
        </Box>
    );
}

export default Stopwatch;