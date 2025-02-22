import React from 'react';
import { Button, Typography, Box, TextField } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useGroups } from '../contexts/GroupContext';
import { DateTime } from 'luxon';

function Stopwatch({ onComplete, onCancel, discordData, activityName, activityGroup }) {
    const { groups } = useGroups();
    // カスタムフック useStopwatch を利用してタイマー処理全体を管理する
    const {
        displayTime,
        isPaused,
        togglePause,
        complete,
        cancel,
        updateStartTime,
        currentStartTime,
    } = useStopwatch(discordData, { onComplete, onCancel });

    // 編集モード用の状態
    const [isEditingStartTime, setIsEditingStartTime] = React.useState(false);
    const [editedStartTime, setEditedStartTime] = React.useState("");

    // 編集ボタン押下時：現在の開始時刻を編集用 state にセット
    const handleEditStartTime = () => {
        if (currentStartTime) {
            setEditedStartTime(DateTime.fromMillis(currentStartTime).toFormat("yyyy-MM-dd'T'HH:mm"));
        } else {
            // もし currentStartTime がない場合は現在時刻を利用
            setEditedStartTime(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
        }
        setIsEditingStartTime(true);
    };

    // 保存ボタン押下時：入力された開始時刻で更新
    const handleSaveStartTime = () => {
        const newStart = DateTime.fromFormat(editedStartTime, "yyyy-MM-dd'T'HH:mm").toMillis();
        if (newStart > Date.now()) {
            alert("Start time cannot be in the future");
            return;
        }
        try {
            updateStartTime(newStart);
            setIsEditingStartTime(false);
        } catch (error) {
            alert(error.message);
        }
    };

    // キャンセルボタン押下時：編集モード終了
    const handleCancelEditStartTime = () => {
        setIsEditingStartTime(false);
    };

    // 現在の開始時刻の表示（currentStartTime を利用）
    const formattedStartTime = currentStartTime
        ? DateTime.fromMillis(currentStartTime).toFormat("yyyy-MM-dd HH:mm")
        : "未設定";

    // 時間をフォーマットする関数
    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <Box sx={{ p: 2, border: '1px solid #ccc', borderRadius: 2, textAlign: 'center' }}>
            <Typography variant="h6" sx={{ mb: 1 }}>
                {getIconForGroup(activityGroup, groups)}
                {activityName}
            </Typography>
            <Typography variant='h5'>{formatTime(displayTime)}</Typography>
            {/* 開始時刻表示と編集UI */}
            <Box sx={{ mb: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {isEditingStartTime ? (
                    <>
                        <TextField
                            type="datetime-local"
                            value={editedStartTime}
                            onChange={(e) => setEditedStartTime(e.target.value)}
                        />
                        <Button onClick={handleSaveStartTime} variant="contained" color="primary" sx={{ ml: 1 }}>
                            保存
                        </Button>
                        <Button onClick={handleCancelEditStartTime} variant="outlined" sx={{ ml: 1 }}>
                            キャンセル
                        </Button>
                    </>
                ) : (
                    <>
                        <Typography>
                            Start time: {formattedStartTime}
                        </Typography>
                        <Button onClick={handleEditStartTime} variant="text" size="small">
                            Edit
                        </Button>
                    </>
                )}
            </Box>
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