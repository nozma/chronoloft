import React, { forwardRef, useEffect, useImperativeHandle } from 'react';
import { Button, Typography, Box, TextField, IconButton, Popover } from '@mui/material';
import getIconForGroup from '../utils/getIconForGroup';
import useStopwatch from '../hooks/useStopwatch';
import { useGroups } from '../contexts/GroupContext';
import { useRecords } from '../contexts/RecordContext';
import { DateTime } from 'luxon';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
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

    // Start Time 編集用状態
    const [anchorEl, setAnchorEl] = React.useState(null);
    const [editedStartTime, setEditedStartTime] = React.useState("");

    // カレンダーアイコン押下時に DatePicker を表示
    const handleOpenPicker = (event) => {
        if (currentStartTime) {
            setEditedStartTime(DateTime.fromMillis(currentStartTime).toFormat("yyyy-MM-dd'T'HH:mm"));
        } else {
            setEditedStartTime(DateTime.local().toFormat("yyyy-MM-dd'T'HH:mm"));
        }
        setAnchorEl(event.currentTarget);
    };

    const handleClosePicker = () => {
        setAnchorEl(null);
    };

    const handleChangeStartTime = (value) => {
        setEditedStartTime(value);
        const dt = DateTime.fromFormat(value, "yyyy-MM-dd'T'HH:mm");
        if (dt.isValid) {
            try {
                updateStartTime(dt.toMillis());
            } catch (error) {
                alert(error.message);
            }
        }
    };

    const adjustStartTime = (delta) => {
        const dt = DateTime.fromFormat(editedStartTime, "yyyy-MM-dd'T'HH:mm");
        if (!dt.isValid) return;
        const newDt = dt.plus({ minutes: delta });
        setEditedStartTime(newDt.toFormat("yyyy-MM-dd'T'HH:mm"));
        try {
            updateStartTime(newDt.toMillis());
        } catch (error) {
            alert(error.message);
        }
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
        // ① 終了時刻がまだ無い＝ストップウォッチ動作中なので「現在時刻」を基準に
        const baseline = DateTime.local();

        // ② 全レコードを終了時刻(created_at)降順ソート
        const sorted = [...records].sort(
            (a, b) => new Date(b.created_at) - new Date(a.created_at)
        );

        // ③ baseline より前のレコードを探す
        const prevRec = sorted.find(rec => {
            const endLocal = DateTime.fromISO(rec.created_at, { zone: 'utc' }).toLocal();
            return endLocal < baseline;
        });

        // ④ 見つかったらその終了時刻、無ければ baseline をセット
        const dt = prevRec
            ? DateTime.fromISO(prevRec.created_at, { zone: 'utc' }).toLocal()
            : baseline;
        setEditedStartTime(dt.toFormat("yyyy-MM-dd'T'HH:mm"));
        try {
            updateStartTime(dt.toMillis());
        } catch (error) {
            alert(error.message);
        }
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
                        <Typography variant="body1">Start Time: {formattedStartTime}</Typography>
                        <IconButton onClick={handleOpenPicker} sx={{ ml: -1 }} size='small'>
                            <CalendarMonthIcon fontSize='small' />
                        </IconButton>
                        <Button size="small" onClick={handleFillPrevEnd}>Fill</Button>
                        <IconButton size="small" onClick={() => adjustStartTime(-5)}>-5</IconButton>
                        <IconButton size="small" onClick={() => adjustStartTime(-1)}>-1</IconButton>
                        <IconButton size="small" onClick={() => adjustStartTime(1)}>+1</IconButton>
                        <IconButton size="small" onClick={() => adjustStartTime(5)}>+5</IconButton>
                        <Popover
                            open={Boolean(anchorEl)}
                            anchorEl={anchorEl}
                            onClose={handleClosePicker}
                            anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                        >
                            <Box sx={{ p: 1 }}>
                                <TextField
                                    type="datetime-local"
                                    value={editedStartTime}
                                    onChange={(e) => handleChangeStartTime(e.target.value)}
                                    size='small'
                                />
                            </Box>
                        </Popover>
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