import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Button, Typography, Box, TextField, IconButton } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useGroups } from '../contexts/GroupContext';
import { useRecords } from '../contexts/RecordContext';
import { DateTime } from 'luxon';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import SyncIcon from '@mui/icons-material/Sync';
import { updateDiscordPresence } from '../services/api';

const Stopwatch = forwardRef((props, ref) => {
    const { groups } = useGroups();
    const { records } = useRecords();
    // カスタムフック useStopwatch を利用してタイマー処理全体を管理する
    const {
        displayTime,
        complete,
        finishAndReset,
        cancel,
        updateStartTime,
        currentStartTime,
        memo,
        setMemo,
        isDiscordBusy
    } = useStopwatch('stopwatchState', props.discordData, { onComplete: props.onComplete, onCancel: props.onCancel });

    useImperativeHandle(ref, () => ({
        complete,
        finishAndReset,
        isDiscordBusy
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

    // ストップウォッチ起動中にタイトルバーを変更するため、onTickを呼び出す
    useEffect(() => {
        if (props.onTick) {
            props.onTick(displayTime);
        }
    }, [displayTime, props.onTick]);

    // 直近のレコード終了時刻を取得して editedStartTime にセット
    const handleFillPrevEnd = () => {
        // 作成日時降順ソート
        const sorted = [...records].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );
        const last = sorted[0];
        const dt = last
            ? DateTime.fromISO(last.created_at, { zone: 'utc' }).toLocal()
            : DateTime.local();  // レコードなしは「今」
        setEditedStartTime(dt.toFormat("yyyy-MM-dd'T'HH:mm"));
    };

    return (
        <>
            <Box
                sx={(theme) => ({
                    display: 'flex',
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100%',
                    backgroundColor: theme.palette.mode === 'dark'
                        ? '#222'  // ダークモード用
                        : '#fafafa', // ライトモード用
                    zIndex: 100,
                    py: 2,
                    px: 8
                })}
            >
                <Box sx={{ flex: 1, width: '10%' }} >
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
                                <Button size="small" onClick={handleFillPrevEnd}>
                                    Fill
                                </Button>
                                <Button onClick={handleSaveStartTime} variant="contained" color="primary">
                                    Save
                                </Button>
                                <Button onClick={handleCancelEditStartTime} variant="outlined">
                                    Cancel
                                </Button>
                            </>
                        ) : (
                            <>
                                <Typography variant="body1">Start Time: {formattedStartTime}</Typography>
                                <IconButton onClick={handleEditStartTime} sx={{ ml: -1 }} size='small' >
                                    <EditIcon fontSize='small' />
                                </IconButton>
                            </>
                        )}
                    </Box>
                    {/* 経過時間と完了・キャンセルアイコン */}
                    <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                        <Typography variant="h4" sx={{ mr: 2 }}>{formatTime(displayTime)}</Typography>
                        <IconButton color="primary" onClick={() => complete(memo)} disabled={isDiscordBusy}>
                            <CheckCircleIcon fontSize='large' />
                        </IconButton>
                        <IconButton color="error" onClick={cancel} disabled={isDiscordBusy}>
                            <CancelIcon fontSize='large' />
                        </IconButton>
                    </Box>
                </Box>
                <Box sx={{ position: 'relative', flex: 1, mt: 1 }}>
                    {/* メモ入力欄 */}
                    <TextField
                        label="Memo"
                        multiline
                        rows={2}
                        fullWidth
                        value={memo}
                        onChange={(e) => setMemo(e.target.value)}
                    />
                    {/* Update Presence ボタン */}
                    {props.discordData && (
                        <IconButton
                            size="small"
                            onClick={() => {
                                const data = {
                                    group: props.activityGroup,
                                    activity_name: props.activityName,
                                    details: memo,
                                    asset_key: props.discordData?.asset_key || 'default_image',
                                };
                                updateDiscordPresence(data)
                                    .catch(err => console.error('Failed to update presence:', err));
                            }}
                            disabled={isDiscordBusy}
                            sx={{
                                position: 'absolute',
                                right: 4,
                                bottom: 8,
                                p: 0.5,
                                bgcolor: 'background.paper',
                                boxShadow: 1,
                                '&:hover': { bgcolor: 'action.hover' },
                            }}
                        >
                            <SyncIcon fontSize="small" />
                        </IconButton>
                    )}
                </Box>
            </Box>
            <Box sx={{ marginTop: 8 }} />
        </>
    );
});

export default Stopwatch;