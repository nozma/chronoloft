import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Button, Typography, Box, TextField, IconButton } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useGroups } from '../contexts/GroupContext';
import { DateTime } from 'luxon';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import { startDiscordPresence } from '../services/api';

const Stopwatch = forwardRef((props, ref) => {
    //function Stopwatch({ onComplete, onCancel, discordData, activityName, activityGroup }) {
    const { groups } = useGroups();
    // カスタムフック useStopwatch を利用してタイマー処理全体を管理する
    const {
        displayTime,
        complete,
        finishAndReset,
        cancel,
        updateStartTime,
        currentStartTime,
        memo,
        setMemo
    } = useStopwatch(props.discordData, { onComplete: props.onComplete, onCancel: props.onCancel });

    useImperativeHandle(ref, () => ({
        complete,
        finishAndReset
    }));

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
        ? DateTime.fromMillis(currentStartTime).toFormat("HH:mm")
        : "Undefined";

    // 時間をフォーマットする関数
    const formatTime = (ms) => {
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    };

    return (
        <Box sx={{ p: 2, borderRadius: 4 }}>
            <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 1 }}>
                {/* アクティビティ名・アイコン表示 */}
                {getIconForGroup(props.activityGroup, groups)}
                <Typography variant="h6" sx={{ mr: 2 }}>
                    {props.activityName}
                </Typography>
                {/* 開始時刻表示と編集UI */}
                {isEditingStartTime ? (
                    <>
                        <TextField
                            type="datetime-local"
                            value={editedStartTime}
                            onChange={(e) => setEditedStartTime(e.target.value)}
                            size='small'
                        />
                        <Button onClick={handleSaveStartTime} variant="contained" color="primary">
                            Save
                        </Button>
                        <Button onClick={handleCancelEditStartTime} variant="outlined">
                            Cancel
                        </Button>
                    </>
                ) : (
                    <>
                        <Typography variant="body1">(Start Time: {formattedStartTime}</Typography>
                        <IconButton onClick={handleEditStartTime} sx={{ m: 0 }} size='small'>
                            <EditIcon fontSize='small' />
                        </IconButton>
                        <Typography variant='body1'>)</Typography>
                    </>
                )}
            </Box>
            {/* 経過時間と完了・キャンセルアイコン */}
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                <Typography variant="h4" sx={{ mr: 2 }}>{formatTime(displayTime)}</Typography>
                <IconButton color="primary" onClick={() => complete(memo)} >
                    <CheckCircleIcon fontSize='large' />
                </IconButton>
                <IconButton color="error" onClick={cancel} >
                    <CancelIcon fontSize='large' />
                </IconButton>
            </Box>
            {/* メモ入力欄 */}
            <TextField
                label="Memo"
                multiline
                rows={2}
                fullWidth
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                sx={{ my: 2 }}
            />
            {/* Update Presence ボタン */}
            <Button
                variant="outlined"
                onClick={() => {
                    const data = {
                        group: props.activityGroup,
                        activity_name: props.activityName,
                        details: memo,
                        asset_key: props.discordData?.asset_key || "default_image",
                    };
                    startDiscordPresence(data)
                        .catch(err => console.error("Failed to update presence:", err));
                }}
            >
                Update Discord Presence
            </Button>
        </Box>
    );
});

export default Stopwatch;